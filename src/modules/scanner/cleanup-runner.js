const createCleanupRunner = ({
  skipCleanup,
  performCleanup,
  addMainLog,
  consoleLogger = console,
  exit = code => process.exit(code),
}) => {
  const runCleanup = async () => {
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
    } catch (err) {
      consoleLogger.error(` ! 在执行清理过程中出错: ${err.message}`);
      addMainLog({
        level: 'error',
        message: `在执行清理过程中出错: ${err.message}`,
      });
      return exit(1);
    }
  };

  return { runCleanup };
};

module.exports = { createCleanupRunner };
