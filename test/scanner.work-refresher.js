const { expect } = require('chai');
const { createWorkRefresher } = require('../src/modules/scanner/work-refresher');

describe('createWorkRefresher', () => {
  let calls;
  let tasks;

  beforeEach(() => {
    calls = {
      mainLogs: [],
      emittedMainLogs: [],
      removedTasks: [],
      results: [],
      consoleLogs: [],
    };
    tasks = [
      { rjcode: '000123', logs: [] },
      { rjcode: '000456', logs: [] },
    ];
  });

  const createRefresher = () =>
    createWorkRefresher({
      tasks,
      addMainLog: log => calls.mainLogs.push(log),
      emitMainLog: message => calls.emittedMainLogs.push(message),
      removeTask: rjcode => calls.removedTasks.push(rjcode),
      addResult: (rjcode, result, count) => calls.results.push({ rjcode, result, count }),
      consoleLogger: {
        log: message => calls.consoleLogs.push(message),
      },
    });

  it('refreshes works and records updated and failed results', async () => {
    const { refreshWorks } = createRefresher();
    const query = Promise.resolve([{ id: 123 }, { id: 456 }]);
    const processor = id => Promise.resolve(id === 123 ? 'updated' : 'failed');

    const counts = await refreshWorks(query, 'id', processor);

    expect(counts.toJSON()).to.deep.equal({
      added: 0,
      failed: 1,
      skipped: 0,
      updated: 1,
    });
    expect(tasks).to.deep.equal([
      { rjcode: '000123', logs: [], result: 'updated' },
      { rjcode: '000456', logs: [], result: 'failed' },
    ]);
    expect(calls.removedTasks).to.deep.equal(['000123', '000456']);
    expect(calls.results).to.deep.equal([
      { rjcode: '000123', result: 'updated', count: 1 },
      { rjcode: '000456', result: 'failed', count: 1 },
    ]);
  });

  it('uses the configured id column name', async () => {
    const { refreshWorks } = createRefresher();
    const processedIds = [];
    const query = Promise.resolve([{ work_id: 123 }]);

    await refreshWorks(query, 'work_id', id => {
      processedIds.push(id);
      return Promise.resolve('updated');
    });

    expect(processedIds).to.deep.equal([123]);
  });

  it('emits start and finish logs with legacy messages', async () => {
    const { refreshWorks } = createRefresher();

    await refreshWorks(Promise.resolve([{ id: 123 }]), 'id', () => Promise.resolve('updated'));

    expect(calls.consoleLogs).to.deep.equal([' * 共 1 个音声.']);
    expect(calls.mainLogs).to.deep.equal([
      {
        level: 'info',
        message: '共 1 个作品. 开始刷新',
      },
    ]);
    expect(calls.emittedMainLogs).to.deep.equal([' * 完成元数据更新 1 个，失败 0 个.']);
  });
});
