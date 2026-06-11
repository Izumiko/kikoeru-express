import type { ScannerLog } from '../../media/folder-scanner.js';

type CleanupRunnerOptions = {
  skipCleanup: boolean;
  performCleanup: () => Promise<void>;
  addMainLog: (log: ScannerLog) => void;
  consoleLogger?: Pick<Console, 'log' | 'error'>;
  exit?: (code: number) => void;
};

const createCleanupRunner = ({
  skipCleanup,
  performCleanup,
  addMainLog,
  consoleLogger = console,
  exit = code => process.exit(code),
}: CleanupRunnerOptions) => {
  const runCleanup = async (): Promise<void> => {
    if (skipCleanup) {
      consoleLogger.log(' * 根据设置跳过清理.');
      return;
    }

    try {
      consoleLogger.log(' * 清理本地不再存在的音声的数据与封面图片...');
      addMainLog({
        level: 'info',
        message: '清理本地不再存在的音声的数据与封面图片...',
      });

      await performCleanup();

      consoleLogger.log(' * 清理完成. 现在开始扫描...');
      addMainLog({
        level: 'info',
        message: '清理完成. 现在开始扫描...',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      consoleLogger.error(` ! 在执行清理过程中出错: ${message}`);
      addMainLog({
        level: 'error',
        message: `在执行清理过程中出错: ${message}`,
      });
      exit(1);
    }
  };

  return { runCleanup };
};

export { createCleanupRunner };
