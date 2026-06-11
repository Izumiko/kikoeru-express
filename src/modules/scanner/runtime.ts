import db from '../../database.js';
import { closeDatabaseConnection } from '../../database/client.js';
import { createSchema } from '../../database/schema.js';
import { deleteCoverImageFromDisk, saveCoverImageToDisk } from '../media/cover-storage.js';
import { getFolderList } from '../media/folder-scanner.js';
import { hashLegacyPassword } from '../auth/service.js';
import {
  httpClient,
  nameToUUID,
  scrapeDynamicWorkMetadataFromDLsite,
  scrapeWorkMetadataFromDLsite,
} from '../scraper.js';

import { config } from '../../../config.js';
import { updateLock } from '../../upgrade/lock.js';
import { createCleanupRunner } from './cleanup-runner.js';
import { createConcurrencyLimiter } from './concurrency-limiter.js';
import { createCoverDownloader } from './cover-downloader.js';
import { createFolderCollector } from './folder-collector.js';
import { createFolderProcessorRunner } from './folder-processor-runner.js';
import { ScannerLifecycle } from './lifecycle.js';
import { ScannerLogger } from './logger.js';
import { createMetadataIngestion } from './metadata-ingestion.js';
import { createMetadataUpdater } from './metadata-updater.js';
import { createMissingWorkCleaner } from './missing-work-cleaner.js';
import { createScanInitializer } from './scan-initializer.js';
import { createScanRunner } from './scan-runner.js';
import { ScanSession } from './session.js';
import { createUpdateRunner } from './update-runner.js';
import { createVoiceActorRepairRunner } from './voice-actor-repair-runner.js';
import { createWorkProcessor } from './work-processor.js';
import { createWorkRefresher } from './work-refresher.js';
import { SOCKET_EVENTS } from '../socket/events.js';

type ScannerRuntimeMessage = {
  emit?: typeof SOCKET_EVENTS.SCAN_INIT_STATE;
  exit?: unknown;
};

// 只有在子进程中 process 对象才有 send() 方法。
const sendProcessMessage = (event: unknown): void => {
  if (process.send) {
    process.send(event);
  }
};

const scanSession = new ScanSession(event => sendProcessMessage(event));
const scannerLogger = new ScannerLogger(scanSession);
const scannerLifecycle = new ScannerLifecycle({
  send: event => sendProcessMessage(event),
  destroyDatabase: closeDatabaseConnection,
  exit: code => process.exit(code),
});
const tasks = scanSession.tasks;

const addTask = rjcode => scanSession.addTask(rjcode);
const removeTask = rjcode => scanSession.removeTask(rjcode);
const addLogForTask = (rjcode, log) => scanSession.addLogForTask(rjcode, log);
const addResult = (rjcode, result, count) => scanSession.addResult(rjcode, result, count);
const addMainLog = log => scanSession.addMainLog(log);
const { getCoverImage } = createCoverDownloader({
  axios: httpClient,
  saveCoverImageToDisk,
  addLogForTask,
});

const emitMainLog = (message, level = 'info', truncate = 3) => scannerLogger.emitMainLog(message, level, truncate);
const emitTaskLog = (message, rjcode, level = 'info', truncate = 15) =>
  scannerLogger.emitTaskLog(message, rjcode, level, truncate);

process.on('message', (m: unknown) => {
  const message = m as ScannerRuntimeMessage;
  if (message.emit === SOCKET_EVENTS.SCAN_INIT_STATE) {
    scanSession.emitInitState();
  } else if (message.exit) {
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
  workExists: db.workExists,
  coverFolderDir: config.coverFolderDir,
  tagLanguage: config.tagLanguage,
  getMetadata,
  getCoverImage,
  addTask,
  addLogForTask,
});
const { performCleanup } = createMissingWorkCleaner({
  listWorkStorageLocations: db.listWorkStorageLocations,
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
  hashPassword: hashLegacyPassword,
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

const { limit } = createConcurrencyLimiter({
  max: config.maxParallelism, // 并发请求上限
});
const processFolderLimited = limit(processFolder);
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

const updateMetadataLimited = limit((id, options = null) => updateMetadata(id, options));
const updateVoiceActorLimited = limit(id => updateMetadata(id, { includeVA: true }));
const { performUpdate, fixVoiceActorBug } = createUpdateRunner({
  listWorkIds: db.listWorkIds,
  listWorkIdsByVoiceActorIds: db.listWorkIdsByVoiceActorIds,
  refreshWorks,
  updateMetadata: updateMetadataLimited,
  updateVoiceActor: updateVoiceActorLimited,
  finishUpdate: (message, exitCode) => scannerLifecycle.finish(message, exitCode),
  nameToUUID,
});

export { performScan, performUpdate };
