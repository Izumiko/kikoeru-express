import { expect } from 'vitest';
import { ScanSession } from '../src/modules/scanner/support/session.js';

describe('ScanSession', () => {
  let events;
  let session;

  beforeEach(() => {
    events = [];
    session = new ScanSession(event => events.push(JSON.parse(JSON.stringify(event))));
  });

  it('returns the legacy initial state payload shape', () => {
    session.addTask('RJ000123');
    session.addMainLog({ level: 'info', message: 'started' });
    session.addResult('RJ000123', 'success', 1);
    session.emitInitState();

    expect(events[events.length - 1]).to.deep.equal({
      event: 'SCAN_INIT_STATE',
      payload: {
        tasks: [{ rjcode: 'RJ000123', result: null, logs: [] }],
        failedTasks: [],
        mainLogs: [{ level: 'info', message: 'started' }],
        results: [{ rjcode: 'RJ000123', result: 'success', count: 1 }],
      },
    });
  });

  it('emits task updates when task logs are added and removed', () => {
    session.addTask('RJ000123');
    session.addLogForTask('RJ000123', { level: 'info', message: 'running' });
    session.removeTask('RJ000123');

    expect(events).to.deep.equal([
      {
        event: 'SCAN_TASKS',
        payload: {
          tasks: [{ rjcode: 'RJ000123', result: null, logs: [{ level: 'info', message: 'running' }] }],
        },
      },
      {
        event: 'SCAN_TASKS',
        payload: {
          tasks: [],
        },
      },
    ]);
  });

  it('moves failed tasks to the failed task payload on removal', () => {
    session.addTask('RJ000123');
    session.tasks[0].result = 'failed';

    session.removeTask('RJ000123');

    expect(events).to.deep.equal([
      {
        event: 'SCAN_TASKS',
        payload: {
          tasks: [],
        },
      },
      {
        event: 'SCAN_FAILED_TASKS',
        payload: {
          failedTasks: [{ rjcode: 'RJ000123', result: 'failed', logs: [] }],
        },
      },
    ]);
  });

  it('emits main log and result updates with legacy event names', () => {
    session.addMainLog({ level: 'info', message: 'started' });
    session.addResult('RJ000123', 'success', 1);

    expect(events).to.deep.equal([
      {
        event: 'SCAN_MAIN_LOGS',
        payload: {
          mainLogs: [{ level: 'info', message: 'started' }],
        },
      },
      {
        event: 'SCAN_RESULTS',
        payload: {
          results: [{ rjcode: 'RJ000123', result: 'success', count: 1 }],
        },
      },
    ]);
  });
});
