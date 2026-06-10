/* eslint-disable node/no-unpublished-require */
const { expect } = require('chai');
const { createScannerSocketGateway } = require('../src/modules/socket/scanner-gateway');

const createFakeSocket = () => {
  const handlers = {};
  const emitted = [];

  return {
    request: { user: { name: 'admin' } },
    emitted,
    emit: (event, payload) => emitted.push({ event, payload }),
    on: (event, handler) => {
      handlers[event] = handler;
    },
    trigger: (event, payload) => handlers[event](payload),
  };
};

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

describe('createScannerSocketGateway', () => {
  let calls;
  let processes;

  beforeEach(() => {
    calls = {
      ioHandlers: {},
      ioEmits: [],
      forks: [],
      errors: [],
    };
    processes = [];
  });

  const createGateway = () =>
    createScannerSocketGateway({
      io: {
        emit: (event, payload) => calls.ioEmits.push({ event, payload }),
        on: (event, handler) => {
          calls.ioHandlers[event] = handler;
        },
      },
      fork: (scriptPath, args, options) => {
        const child = createFakeProcess();
        processes.push(child);
        calls.forks.push({ scriptPath, args, options });
        return child;
      },
      scannerScriptPath: 'scanner.js',
      updaterScriptPath: 'updater.js',
      config: { auth: true },
      consoleLogger: {
        error: err => calls.errors.push(err),
      },
    });

  it('binds connection handlers and emits the legacy success payload', () => {
    const gateway = createGateway();
    const socket = createFakeSocket();

    gateway.bind();
    calls.ioHandlers.connection(socket);

    expect(socket.emitted).to.deep.equal([
      {
        event: 'success',
        payload: {
          message: '成功登录管理后台.',
          user: { name: 'admin' },
          auth: true,
        },
      },
    ]);
  });

  it('starts scan and update child processes without changing event names', () => {
    const gateway = createGateway();
    const socket = createFakeSocket();
    gateway.bindSocket(socket);

    socket.trigger('PERFORM_SCAN');
    socket.trigger('PERFORM_UPDATE');

    expect(calls.forks).to.deep.equal([
      {
        scriptPath: 'scanner.js',
        args: [],
        options: { silent: false },
      },
    ]);

    processes[0].trigger('exit', 0);
    socket.trigger('PERFORM_UPDATE');

    expect(calls.forks[1]).to.deep.equal({
      scriptPath: 'updater.js',
      args: ['--refreshAll'],
      options: { silent: false },
    });
  });

  it('recovers scanner state, forwards child messages, and emits scan errors on non-zero exit', () => {
    const gateway = createGateway();
    const socket = createFakeSocket();
    gateway.bindSocket(socket);

    socket.trigger('PERFORM_SCAN');
    socket.trigger('ON_SCANNER_PAGE');
    processes[0].trigger('message', { event: 'SCAN_TASKS', payload: { tasks: [] } });
    processes[0].trigger('exit', 1);

    expect(processes[0].sent).to.deep.equal([{ emit: 'SCAN_INIT_STATE' }]);
    expect(calls.ioEmits).to.deep.equal([
      { event: 'SCAN_TASKS', payload: { tasks: [] } },
      { event: 'SCAN_ERROR', payload: undefined },
    ]);
  });

  it('sends the legacy exit signal when killing the scanner process', () => {
    const gateway = createGateway();
    const socket = createFakeSocket();
    gateway.bindSocket(socket);

    socket.trigger('PERFORM_SCAN');
    socket.trigger('KILL_SCAN_PROCESS');

    expect(processes[0].sent).to.deep.equal([{ exit: 1 }]);
  });
});
