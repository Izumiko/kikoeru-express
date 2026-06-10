const { expect } = require('chai');
const { createScannerProcessController } = require('../src/modules/socket/scanner-process-controller');

const createFakeProcess = () => {
  const handlers = {};
  const sent = [];

  return {
    sent,
    send: message => sent.push(message),
    on: (event, handler) => {
      handlers[event] = handler;
    },
    trigger: (event, payload) => handlers[event](payload),
  };
};

describe('createScannerProcessController', () => {
  let calls;
  let processes;

  beforeEach(() => {
    calls = {
      forks: [],
      emits: [],
    };
    processes = [];
  });

  const createController = () =>
    createScannerProcessController({
      fork: (scriptPath, args, options) => {
        const child = createFakeProcess();
        processes.push(child);
        calls.forks.push({ scriptPath, args, options });
        return child;
      },
      scannerScriptPath: 'scanner.js',
      updaterScriptPath: 'updater.js',
      emit: (event, payload) => calls.emits.push({ event, payload }),
    });

  it('starts scanner and update processes with legacy arguments', () => {
    const controller = createController();

    controller.startScan();
    controller.startUpdate();
    processes[0].trigger('exit', 0);
    controller.startUpdate();

    expect(calls.forks).to.deep.equal([
      { scriptPath: 'scanner.js', args: [], options: { silent: false } },
      { scriptPath: 'updater.js', args: ['--refreshAll'], options: { silent: false } },
    ]);
  });

  it('requests scanner state, forwards child messages, and emits errors on failed exits', () => {
    const controller = createController();

    controller.startScan();
    controller.requestInitState();
    controller.kill();
    processes[0].trigger('message', { event: 'SCAN_TASKS', payload: { tasks: [] } });
    processes[0].trigger('exit', 1);

    expect(processes[0].sent).to.deep.equal([{ emit: 'SCAN_INIT_STATE' }, { exit: 1 }]);
    expect(calls.emits).to.deep.equal([
      { event: 'SCAN_TASKS', payload: { tasks: [] } },
      { event: 'SCAN_ERROR', payload: undefined },
    ]);
  });
});
