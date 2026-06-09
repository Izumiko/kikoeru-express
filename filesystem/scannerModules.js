const LimitPromise = require('limit-promise'); // 限制并发数量

const axios = require('../scraper/axios.js'); // 数据请求
const { scrapeWorkMetadataFromDLsite, scrapeDynamicWorkMetadataFromDLsite } = require('../scraper/dlsite');
const db = require('../database/db');
const { createSchema } = require('../database/schema');
const { deleteCoverImageFromDisk, saveCoverImageToDisk } = require('../src/modules/media/cover-storage');
const { getFolderList } = require('../src/modules/media/folder-scanner');
const { formatRjCode } = require('../src/modules/media/rj-code');
const { md5 } = require('../auth/utils');
const { nameToUUID } = require('../scraper/utils');

const { config } = require('../config');
const { updateLock } = require('../upgrade');
const { createCleanupRunner } = require('../src/modules/scanner/cleanup-runner');
const { createCoverDownloader } = require('../src/modules/scanner/cover-downloader');
const { createUpdateFinishedMessage } = require('../src/modules/scanner/counters');
const { createFolderCollector } = require('../src/modules/scanner/folder-collector');
const { createFolderProcessorRunner } = require('../src/modules/scanner/folder-processor-runner');
const { ScannerLifecycle } = require('../src/modules/scanner/lifecycle');
const { ScannerLogger } = require('../src/modules/scanner/logger');
const { createMetadataUpdater } = require('../src/modules/scanner/metadata-updater');
const { createMissingWorkCleaner } = require('../src/modules/scanner/missing-work-cleaner');
const { createScanInitializer } = require('../src/modules/scanner/scan-initializer');
const { createScanRunner } = require('../src/modules/scanner/scan-runner');
const { ScanSession } = require('../src/modules/scanner/session');
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

/**
 * 从 DLsite 抓取该音声的元数据，并保存到数据库，
 * 返回一个 Promise 对象，处理结果: 'added' or 'failed'
 * @param {number} id work id
 * @param {string} rootFolderName 根文件夹别名
 * @param {string} dir 音声文件夹相对路径
 * @param {string} tagLanguage 标签语言，'ja-jp', 'zh-tw' or 'zh-cn'，默认'zh-cn'
 */
const getMetadata = (id, rootFolderName, dir, tagLanguage) => {
  const rjcode = formatRjCode(id); // zero-pad to 6 digits
  console.log(` -> [RJ${rjcode}] 从 DLSite 抓取元数据...`);
  addLogForTask(rjcode, {
    level: 'info',
    message: '从 DLSite 抓取元数据...',
  });

  return scrapeWorkMetadataFromDLsite(id, tagLanguage) // 抓取该音声的元数据
    .then(metadata => {
      // 将抓取到的元数据插入到数据库
      console.log(` -> [RJ${rjcode}] 元数据抓取成功，准备添加到数据库...`);
      addLogForTask(rjcode, {
        level: 'info',
        message: '元数据抓取成功，准备添加到数据库...',
      });

      metadata.rootFolderName = rootFolderName;
      metadata.dir = dir;
      return db
        .insertWorkMetadata(metadata)
        .then(() => {
          console.log(` -> [RJ${rjcode}] 元数据成功添加到数据库.`);
          addLogForTask(rjcode, {
            level: 'info',
            message: '元数据成功添加到数据库.',
          });

          return 'added';
        })
        .catch(err => {
          console.error(`  ! [RJ${rjcode}] 在插入元数据过程中出错: ${err.message}`);
          addLogForTask(rjcode, {
            level: 'error',
            message: `在插入元数据过程中出错: ${err.message}`,
          });

          return 'failed';
        });
    })
    .catch(err => {
      console.error(`  ! [RJ${rjcode}] 在抓取元数据过程中出错: ${err.message}`);
      addLogForTask(rjcode, {
        level: 'error',
        message: `在抓取元数据过程中出错: ${err.message}`,
      });

      return 'failed';
    });
};

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

// eslint-disable-next-line no-unused-vars
const performUpdate = async (options = null) => {
  const baseQuery = db.knex('t_work').select('id');
  const processor = id => updateMetadataLimited(id, options);

  const counts = await refreshWorks(baseQuery, 'id', processor);

  const message = createUpdateFinishedMessage(counts);
  scannerLifecycle.finish(message, counts.failed ? 1 : null);
};

const fixVoiceActorBug = () => {
  const baseQuery = db.knex('r_va_work').select('va_id', 'work_id');
  const filter = query => query.where('va_id', nameToUUID('かの仔')).orWhere('va_id', nameToUUID('こっこ'));
  const processor = id => updateVoiceActorLimited(id);
  return refreshWorks(filter(baseQuery), 'work_id', processor);
};

module.exports = { performScan, performUpdate };
