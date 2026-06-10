// @ts-nocheck
import { ScanCounters, createScanFinishedMessage } from './counters.js';

const createFatalLogger = ({ addMainLog, consoleLogger = console, exit = code => process.exit(code) }) => {
  const fatal = (message, err) => {
    consoleLogger.error(` ! ${message}: ${err.message}`);
    addMainLog({
      level: 'error',
      message: `${message}: ${err.message}`,
    });
    exit(1);
    return { fatal: true };
  };

  return { fatal };
};

const createScanRunner = ({
  initializeScan,
  runVoiceActorRepair,
  runCleanup,
  collectUniqueFolders,
  processFolders,
  processFolder,
  finishScan,
  addMainLog,
  consoleLogger = console,
  exit = code => process.exit(code),
}) => {
  const { fatal } = createFatalLogger({ addMainLog, consoleLogger, exit });

  const runScanFolders = async counts => {
    let folderResult;
    try {
      folderResult = await collectUniqueFolders();
    } catch (err) {
      return fatal('在扫描根文件夹的过程中出错', err);
    }

    try {
      counts.increment('skipped', folderResult.duplicateNum);
      await processFolders(folderResult.uniqueFolderList, processFolder, counts);
    } catch (err) {
      return fatal('在并行处理音声文件夹过程中出错', err);
    }

    return { fatal: false };
  };

  const runScan = async () => {
    try {
      await initializeScan();
    } catch (err) {
      return fatal('在构建数据库结构过程中出错', err);
    }

    const counts = new ScanCounters();
    const fixVAFailed = await runVoiceActorRepair(counts);
    await runCleanup();
    const scanFoldersResult = await runScanFolders(counts);
    if (scanFoldersResult && scanFoldersResult.fatal) {
      return scanFoldersResult;
    }

    const message = createScanFinishedMessage(counts);
    finishScan(message, fixVAFailed ? 1 : 0);
    return { fatal: false };
  };

  return {
    runScan,
    runScanFolders,
  };
};

export {
  createFatalLogger,
  createScanRunner,
};
