import { expect } from 'vitest';
import { createCleanupRunner } from '../src/modules/scanner/workers/cleanup-runner.js';

describe('createCleanupRunner', () => {
  let calls;

  beforeEach(() => {
    calls = {
      cleanups: 0,
      mainLogs: [],
      consoleLogs: [],
      consoleErrors: [],
      exits: [],
    };
  });

  const createRunner = (options) =>
    createCleanupRunner({
      skipCleanup: options.skipCleanup,
      performCleanup: () => {
        calls.cleanups += 1;
        return options.cleanupError ? Promise.reject(options.cleanupError) : Promise.resolve();
      },
      addMainLog: (log) => calls.mainLogs.push(log),
      consoleLogger: {
        log: (message) => calls.consoleLogs.push(message),
        error: (message) => calls.consoleErrors.push(message),
      },
      exit: (code) => calls.exits.push(code),
    });

  it('skips cleanup when configured', async () => {
    const { runCleanup } = createRunner({ skipCleanup: true });

    await runCleanup();

    expect(calls.cleanups).to.equal(0);
    expect(calls.consoleLogs).to.deep.equal([' * 根据设置跳过清理.']);
    expect(calls.mainLogs).to.deep.equal([]);
  });

  it('runs cleanup with legacy start and finish logs', async () => {
    const { runCleanup } = createRunner({ skipCleanup: false });

    await runCleanup();

    expect(calls.cleanups).to.equal(1);
    expect(calls.consoleLogs).to.deep.equal([
      ' * 清理本地不再存在的音声的数据与封面图片...',
      ' * 清理完成. 现在开始扫描...',
    ]);
    expect(calls.mainLogs).to.deep.equal([
      {
        level: 'info',
        message: '清理本地不再存在的音声的数据与封面图片...',
      },
      {
        level: 'info',
        message: '清理完成. 现在开始扫描...',
      },
    ]);
  });

  it('logs and exits when cleanup fails', async () => {
    const { runCleanup } = createRunner({
      skipCleanup: false,
      cleanupError: new Error('database failure'),
    });

    await runCleanup();

    expect(calls.exits).to.deep.equal([1]);
    expect(calls.consoleErrors).to.deep.equal([' ! 在执行清理过程中出错: database failure']);
    expect(calls.mainLogs[calls.mainLogs.length - 1]).to.deep.equal({
      level: 'error',
      message: '在执行清理过程中出错: database failure',
    });
  });
});
