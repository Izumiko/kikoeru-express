import { expect } from 'vitest';
import { createScanRunner } from '../src/modules/scanner/scan-runner.js';

describe('createScanRunner', () => {
  let calls;

  beforeEach(() => {
    calls = {
      initialized: 0,
      repairs: [],
      cleanups: 0,
      processed: [],
      finishes: [],
      mainLogs: [],
      consoleErrors: [],
      exits: [],
    };
  });

  const createRunner = options =>
    createScanRunner({
      initializeScan: () => {
        calls.initialized += 1;
        return options.initializeError ? Promise.reject(options.initializeError) : Promise.resolve();
      },
      runVoiceActorRepair: counts => {
        calls.repairs.push(counts);
        counts.increment('updated', options.repairedCount || 0);
        return Promise.resolve(Boolean(options.repairFailed));
      },
      runCleanup: () => {
        calls.cleanups += 1;
        return Promise.resolve();
      },
      collectUniqueFolders: () =>
        options.collectError
          ? Promise.reject(options.collectError)
          : Promise.resolve({
              duplicateNum: options.duplicateNum || 0,
              uniqueFolderList: options.folders || [],
            }),
      processFolders: (folders, processFolder, counts) => {
        calls.processed.push({ folders, processFolder, counts });
        return options.processError ? Promise.reject(options.processError) : Promise.resolve();
      },
      processFolder: 'process-folder',
      finishScan: (message, exitCode) => calls.finishes.push({ message, exitCode }),
      addMainLog: log => calls.mainLogs.push(log),
      consoleLogger: {
        error: message => calls.consoleErrors.push(message),
      },
      exit: code => calls.exits.push(code),
    });

  it('runs scan stages and finishes with accumulated counts', async () => {
    const { runScan } = createRunner({
      repairedCount: 2,
      duplicateNum: 3,
      folders: [{ id: 123 }],
    });

    await runScan();

    expect(calls.initialized).to.equal(1);
    expect(calls.cleanups).to.equal(1);
    expect(calls.processed[0].folders).to.deep.equal([{ id: 123 }]);
    expect(calls.processed[0].processFolder).to.equal('process-folder');
    expect(calls.processed[0].counts.toJSON()).to.deep.equal({
      added: 0,
      failed: 0,
      skipped: 3,
      updated: 2,
    });
    expect(calls.finishes).to.deep.equal([
      {
        message: '扫描完成: 更新 2 个，新增 0 个，跳过 3 个，失败 0 个.',
        exitCode: 0,
      },
    ]);
  });

  it('finishes with exit code 1 when VA repair failed', async () => {
    const { runScan } = createRunner({ repairFailed: true });

    await runScan();

    expect(calls.finishes[0].exitCode).to.equal(1);
  });

  it('logs schema initialization failures as fatal', async () => {
    const { runScan } = createRunner({ initializeError: new Error('schema failed') });

    await runScan();

    expect(calls.exits).to.deep.equal([1]);
    expect(calls.consoleErrors).to.deep.equal([' ! 在构建数据库结构过程中出错: schema failed']);
    expect(calls.mainLogs).to.deep.equal([
      {
        level: 'error',
        message: '在构建数据库结构过程中出错: schema failed',
      },
    ]);
    expect(calls.finishes).to.deep.equal([]);
  });

  it('logs folder collection failures as fatal', async () => {
    const { runScan } = createRunner({ collectError: new Error('scan failed') });

    await runScan();

    expect(calls.exits).to.deep.equal([1]);
    expect(calls.consoleErrors).to.deep.equal([' ! 在扫描根文件夹的过程中出错: scan failed']);
    expect(calls.finishes).to.deep.equal([]);
  });

  it('logs folder processing failures as fatal', async () => {
    const { runScan } = createRunner({ processError: new Error('processor failed') });

    await runScan();

    expect(calls.exits).to.deep.equal([1]);
    expect(calls.consoleErrors).to.deep.equal([' ! 在并行处理音声文件夹过程中出错: processor failed']);
    expect(calls.finishes).to.deep.equal([]);
  });
});
