/* eslint-disable node/no-unpublished-require */
const { expect } = require('chai');
const { createSocketServer } = require('../src/modules/socket/server');

describe('createSocketServer', () => {
  const createServerImpl = calls =>
    class FakeServer {
      constructor(server) {
        calls.constructorArgs.push(server);
        this.engine = {
          use: middleware => calls.engineMiddleware.push(middleware),
        };
      }

      use(middleware) {
        calls.socketMiddleware.push(middleware);
      }

      on(event, handler) {
        calls.handlers[event] = handler;
      }
    };

  const createSocket = () => {
    const handlers = {};
    return {
      request: { user: { name: 'admin' } },
      emitted: [],
      emit(event, payload) {
        this.emitted.push({ event, payload });
      },
      on(event, handler) {
        handlers[event] = handler;
      },
    };
  };

  it('registers auth middleware and scanner gateway when auth is enabled', () => {
    const calls = {
      constructorArgs: [],
      engineMiddleware: [],
      socketMiddleware: [],
      handlers: {},
    };

    const io = createSocketServer({
      server: 'http-server',
      ServerImpl: createServerImpl(calls),
      childProcessImpl: { fork: () => {} },
      appConfig: { auth: true, jwtsecret: 'secret' },
      rootDir: 'root',
    });
    const socket = createSocket();
    calls.handlers.connection(socket);

    expect(io).to.be.an('object');
    expect(calls.constructorArgs).to.deep.equal(['http-server']);
    expect(calls.engineMiddleware).to.have.length(1);
    expect(calls.socketMiddleware).to.have.length(1);
    expect(socket.emitted[0]).to.deep.equal({
      event: 'success',
      payload: {
        message: '成功登录管理后台.',
        user: { name: 'admin' },
        auth: true,
      },
    });
  });

  it('skips auth middleware when auth is disabled', () => {
    const calls = {
      constructorArgs: [],
      engineMiddleware: [],
      socketMiddleware: [],
      handlers: {},
    };

    createSocketServer({
      server: 'http-server',
      ServerImpl: createServerImpl(calls),
      childProcessImpl: { fork: () => {} },
      appConfig: { auth: false, jwtsecret: 'secret' },
      rootDir: 'root',
    });

    expect(calls.engineMiddleware).to.deep.equal([]);
    expect(calls.socketMiddleware).to.deep.equal([]);
    expect(calls.handlers.connection).to.be.a('function');
  });
});
