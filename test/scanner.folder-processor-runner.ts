import { expect } from 'vitest';
import { ScanCounters } from '../src/modules/scanner/counters.js';
import { createFolderProcessorRunner } from '../src/modules/scanner/folder-processor-runner.js';

describe('createFolderProcessorRunner', () => {
  let calls;
  let tasks;

  beforeEach(() => {
    calls = {
      taskLogs: [],
      removedTasks: [],
      results: [],
      consoleLogs: [],
      consoleErrors: [],
    };
    tasks = [
      { rjcode: '000123', logs: [] },
      { rjcode: '000456', logs: [] },
    ];
  });

  const createRunner = () =>
    createFolderProcessorRunner({
      tasks,
      addLogForTask: (rjcode, log) => calls.taskLogs.push({ rjcode, log }),
      removeTask: rjcode => calls.removedTasks.push(rjcode),
      addResult: (rjcode, result, count) => calls.results.push({ rjcode, result, count }),
      consoleLogger: {
        log: message => calls.consoleLogs.push(message),
        error: message => calls.consoleErrors.push(message),
      },
    });

  it('records added folder results with legacy task updates', () => {
    const { processFolderResult } = createRunner();
    const counts = new ScanCounters();

    processFolderResult({ id: 123 }, 'added', counts);

    expect(counts.toJSON()).to.deep.equal({
      added: 1,
      failed: 0,
      skipped: 0,
      updated: 0,
    });
    expect(tasks[0].result).to.equal('added');
    expect(calls.removedTasks).to.deep.equal(['000123']);
    expect(calls.results).to.deep.equal([{ rjcode: '000123', result: 'added', count: 1 }]);
    expect(calls.taskLogs).to.deep.equal([
      {
        rjcode: '000123',
        log: {
          level: 'info',
          message: '添加成功! Added: 1',
        },
      },
    ]);
    expect(calls.consoleLogs).to.deep.equal([' -> [RJ000123] 添加成功! Added: 1']);
  });

  it('records failed folder results with legacy task updates', () => {
    const { processFolderResult } = createRunner();
    const counts = new ScanCounters();

    processFolderResult({ id: 456 }, 'failed', counts);

    expect(counts.failed).to.equal(1);
    expect(tasks[1].result).to.equal('failed');
    expect(calls.removedTasks).to.deep.equal(['000456']);
    expect(calls.results).to.deep.equal([{ rjcode: '000456', result: 'failed', count: 1 }]);
    expect(calls.taskLogs).to.deep.equal([
      {
        rjcode: '000456',
        log: {
          level: 'error',
          message: '添加失败! Failed: 1',
        },
      },
    ]);
    expect(calls.consoleErrors).to.deep.equal([' -> [RJ000456] 添加失败! Failed: 1']);
  });

  it('only increments skipped results without task updates', () => {
    const { processFolderResult } = createRunner();
    const counts = new ScanCounters();

    processFolderResult({ id: 123 }, 'skipped', counts);

    expect(counts.skipped).to.equal(1);
    expect(tasks[0].result).to.equal(undefined);
    expect(calls.removedTasks).to.deep.equal([]);
    expect(calls.results).to.deep.equal([]);
    expect(calls.taskLogs).to.deep.equal([]);
  });

  it('processes folders and accumulates mixed results', async () => {
    const { processFolders } = createRunner();
    const counts = new ScanCounters({ skipped: 2 });
    const processed = [];

    await processFolders(
      [{ id: 123 }, { id: 456 }],
      folder => {
        processed.push(folder.id);
        return Promise.resolve(folder.id === 123 ? 'added' : 'failed');
      },
      counts
    );

    expect(processed).to.deep.equal([123, 456]);
    expect(counts.toJSON()).to.deep.equal({
      added: 1,
      failed: 1,
      skipped: 2,
      updated: 0,
    });
  });
});
