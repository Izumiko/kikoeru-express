const LimitPromise = require('limit-promise'); // 限制并发数量

const axios = require('../scraper/axios.js'); // 数据请求
const { scrapeWorkMetadataFromDLsite, scrapeDynamicWorkMetadataFromDLsite } = require('../scraper/dlsite');
const db = require('../database/db');
const { createSchema } = require('../database/schema');
const { deleteCoverImageFromDisk, saveCoverImageToDisk } = require('../src/modules/media/cover-storage');
const { getFolderList } = require('../src/modules/media/folder-scanner');
const { md5 } = require('../auth/utils');
const { nameToUUID } = require('../scraper/utils');

const { config } = require('../config');
const { updateLock } = require('../upgrade');
const { createCleanupRunner } = require('../src/modules/scanner/cleanup-runner');
const { createCoverDownloader } = require('../src/modules/scanner/cover-downloader');
const { createFolderCollector } = require('../src/modules/scanner/folder-collector');
const { createFolderProcessorRunner } = require('../src/modules/scanner/folder-processor-runner');
const { ScannerLifecycle } = require('../src/modules/scanner/lifecycle');
const { ScannerLogger } = require('../src/modules/scanner/logger');
const { createMetadataIngestion } = require('../src/modules/scanner/metadata-ingestion');
const { createMetadataUpdater } = require('../src/modules/scanner/metadata-updater');
const { createMissingWorkCleaner } = require('../src/modules/scanner/missing-work-cleaner');
const { createScanInitializer } = require('../src/modules/scanner/scan-initializer');
const { createScanRunner } = require('../src/modules/scanner/scan-runner');
const { ScanSession } = require('../src/modules/scanner/session');
const { createUpdateRunner } = require('../src/modules/scanner/update-runner');
const { createVoiceActorRepairRunner } = require('../src/modules/scanner/voice-actor-repair-runner');
const { createWorkProcessor } = require('../src/modules/scanner/work-processor');
const { createWorkRefresher } = require('../src/modules/scanner/work-refresher');

// 只有在子进程中 process 对象才有 send() 方法
process.send = process.send || function () {};

const scanSession = new ScanSession(event => process.send(event));
const scannerLogger = new ScannerLogger(scanSession);
const scannerLifecycle = new ScannerLifecycle({
  send: event => process.send(event),
  destroyDatabase: () => db.knex.destroy(),
  exit: code => process.exit(code),
});
const tasks = scanSession.tasks;

const addTask = rjcode => scanSession.addTask(rjcode);
const removeTask = rjcode => scanSession.removeTask(rjcode);
const addLogForTask = (rjcode, log) => scanSession.addLogForTask(rjcode, log);
const addResult = (rjcode, result, count) => scanSession.addResult(rjcode, result, count);
const addMainLog = log => scanSession.addMainLog(log);
const { getCoverImage } = createCoverDownloader({
  axios,
  saveCoverImageToDisk,
  addLogForTask,
});

const emitMainLog = (message, level = 'info', truncate = 3) => scannerLogger.emitMainLog(message, level, truncate);
const emitTaskLog = (message, rjcode, level = 'info', truncate = 15) =>
  scannerLogger.emitTaskLog(message, rjcode, level, truncate);

process.on('message', m => {
  if (m.emit === 'SCAN_INIT_STATE') {
    scanSession.emitInitState();
  } else if (m.exit) {
    console.error(' ! 终止扫描进程.');
    addMainLog({
      level: 'error',
      message: '终止扫描进程.',
    });

    process.exit(1);
  }
});

const { getMetadata } = createMetadataIngestion({
  scrapeWorkMetadataFromDLsite,
  insertWorkMetadata: db.insertWorkMetadata,
  addLogForTask,
});
const { processFolder } = createWorkProcessor({
  knex: db.knex,
  coverFolderDir: config.coverFolderDir,
  tagLanguage: config.tagLanguage,
  getMetadata,
  getCoverImage,
  addTask,
  addLogForTask,
});
const { performCleanup } = createMissingWorkCleaner({
  knex: db.knex,
  rootFolders: config.rootFolders,
  removeWork: db.removeWork,
  deleteCoverImageFromDisk,
  addMainLog,
});
const { updateMetadata } = createMetadataUpdater({
  tagLanguage: config.tagLanguage,
  scrapeWorkMetadataFromDLsite,
  scrapeDynamicWorkMetadataFromDLsite,
  updateWorkMetadata: db.updateWorkMetadata,
  addTask,
  emitTaskLog,
});
const { refreshWorks } = createWorkRefresher({
  tasks,
  addMainLog,
  emitMainLog,
  removeTask,
  addResult,
});
const { collectUniqueFolders } = createFolderCollector({
  rootFolders: config.rootFolders,
  getFolderList,
  addMainLog,
});
const { processFolders } = createFolderProcessorRunner({
  tasks,
  addLogForTask,
  removeTask,
  addResult,
});
const { initializeScan } = createScanInitializer({
  coverFolderDir: config.coverFolderDir,
  createSchema,
  createUser: db.createUser,
  hashPassword: md5,
  addMainLog,
});
const { runCleanup } = createCleanupRunner({
  skipCleanup: config.skipCleanup,
  performCleanup,
  addMainLog,
});
const { runVoiceActorRepair } = createVoiceActorRepairRunner({
  updateLock,
  repairVoiceActors: () => fixVoiceActorBug(),
  emitMainLog,
});

const MAX = config.maxParallelism; // 并发请求上限
const limitP = new LimitPromise(MAX); // 核心控制器
/**
 * 限制 processFolder 并发数量，
 * 使用控制器包装 processFolder 方法，实际上是将请求函数递交给控制器处理
 */
const processFolderLimited = folder => {
  return limitP.call(processFolder, folder);
};
const { runScan } = createScanRunner({
  initializeScan,
  runVoiceActorRepair,
  runCleanup,
  collectUniqueFolders,
  processFolders,
  processFolder: processFolderLimited,
  finishScan: (message, exitCode) => scannerLifecycle.finish(message, exitCode),
  addMainLog,
});

/**
 * 执行扫描
 * createCoverFolder => createSchema => cleanup => getAllFolderList => processAllFolder
 */
const performScan = () => runScan();

const updateMetadataLimited = (id, options = null) => limitP.call(updateMetadata, id, options);
const updateVoiceActorLimited = id => limitP.call(updateMetadata, id, { includeVA: true });
const { performUpdate, fixVoiceActorBug } = createUpdateRunner({
  knex: db.knex,
  refreshWorks,
  updateMetadata: updateMetadataLimited,
  updateVoiceActor: updateVoiceActorLimited,
  finishUpdate: (message, exitCode) => scannerLifecycle.finish(message, exitCode),
  nameToUUID,
});

module.exports = { performScan, performUpdate };
