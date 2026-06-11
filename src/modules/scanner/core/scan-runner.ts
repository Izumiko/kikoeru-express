import { ScanCounters, createScanFinishedMessage } from '../support/counters.js';
import type { ScannerLog } from '../../media/folder-scanner.js';
import type { WorkFolder } from '../../media/folder-scanner.js';
import type { ScanResult } from '../support/counters.js';

type FatalResult = { fatal: boolean };

type FatalLoggerOptions = {
  addMainLog: (log: ScannerLog) => void;
  consoleLogger?: Pick<Console, 'error'>;
  exit?: (code: number) => void;
};

const getErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const createFatalLogger = ({ addMainLog, consoleLogger = console, exit = code => process.exit(code) }: FatalLoggerOptions) => {
  const fatal = (message: string, err: unknown): FatalResult => {
    const errorMessage = getErrorMessage(err);
    consoleLogger.error(` ! ${message}: ${errorMessage}`);
    addMainLog({
      level: 'error',
      message: `${message}: ${errorMessage}`,
    });
    exit(1);
    return { fatal: true };
  };

  return { fatal };
};

type FolderCollectionResult = {
  uniqueFolderList: WorkFolder[];
  duplicateNum: number;
};

type ScanRunnerOptions = FatalLoggerOptions & {
  initializeScan: () => Promise<void>;
  runVoiceActorRepair: (counts: ScanCounters) => Promise<boolean>;
  runCleanup: () => Promise<void>;
  collectUniqueFolders: () => Promise<FolderCollectionResult>;
  processFolders: (
    folders: WorkFolder[],
    processor: (folder: WorkFolder) => Promise<Extract<ScanResult, 'added' | 'failed' | 'skipped'>>,
    counts: ScanCounters
  ) => Promise<unknown>;
  processFolder: (folder: WorkFolder) => Promise<Extract<ScanResult, 'added' | 'failed' | 'skipped'>>;
  finishScan: (message: string, exitCode: number) => void;
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
}: ScanRunnerOptions) => {
  const { fatal } = createFatalLogger({ addMainLog, consoleLogger, exit });

  const runScanFolders = async (counts: ScanCounters): Promise<FatalResult> => {
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

  const runScan = async (): Promise<FatalResult> => {
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
