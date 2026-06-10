const { expect } = require('chai');
const {
  createSocketAuthMiddleware,
  createSocketJwtEngineMiddleware,
  extractBearerToken,
  extractSocketToken,
} = require('../src/modules/socket/auth');

describe('socket auth middleware', () => {
  it('extracts bearer tokens from authorization headers', () => {
    expect(extractBearerToken('bearer jwt-token')).to.equal('jwt-token');
    expect(extractBearerToken('Bearer jwt-token')).to.equal('jwt-token');
    expect(extractBearerToken('jwt-token')).to.equal(null);
    expect(extractBearerToken(undefined)).to.equal(null);
  });

  it('extracts token from Socket.IO 4 auth payload and legacy query', () => {
    expect(extractSocketToken({ handshake: { auth: { token: 'auth-token' } } })).to.equal('auth-token');
    expect(extractSocketToken({ handshake: { query: { token: 'query-token' } } })).to.equal('query-token');
    expect(extractSocketToken({ handshake: {} })).to.equal(undefined);
  });

  it('accepts admin users and stores them on socket.request.user', () => {
    const socket = {
      handshake: { auth: { token: 'token' } },
      request: {},
    };
    const nextCalls = [];
    const middleware = createSocketAuthMiddleware({
      jwtSecret: 'secret',
      toSocketAdminUser: payload => payload,
      jwtImpl: {
        verify: () => ({ name: 'admin', group: 'administrator' }),
      },
    });

    middleware(socket, err => nextCalls.push(err));

    expect(nextCalls).to.deep.equal([undefined]);
    expect(socket.request.user).to.deep.equal({
      name: 'admin',
      group: 'administrator',
    });
  });

  it('rejects missing tokens and non-admin users', () => {
    const missingTokenErrors = [];
    createSocketAuthMiddleware({
      jwtSecret: 'secret',
      toSocketAdminUser: payload => payload,
      jwtImpl: { verify: () => ({ name: 'admin' }) },
    })({ handshake: {}, request: {} }, err => missingTokenErrors.push(err.message));

    const nonAdminErrors = [];
    createSocketAuthMiddleware({
      jwtSecret: 'secret',
      toSocketAdminUser: payload => payload,
      jwtImpl: { verify: () => ({ name: 'user' }) },
    })({ handshake: { auth: { token: 'token' } }, request: {} }, err => nonAdminErrors.push(err.message));

    expect(missingTokenErrors).to.deep.equal(['Authentication error']);
    expect(nonAdminErrors).to.deep.equal(['只有 admin 账号能登录管理后台.']);
  });

  it('authenticates the initial engine handshake with an authorization bearer token', () => {
    const request = {
      _query: {},
      headers: {
        authorization: 'bearer token',
      },
    };
    const nextCalls = [];
    const middleware = createSocketJwtEngineMiddleware({
      jwtSecret: 'secret',
      toSocketAdminUser: payload => payload,
      jwtImpl: {
        verify: () => ({ name: 'admin', group: 'administrator' }),
      },
    });

    middleware(request, {}, err => nextCalls.push(err));

    expect(nextCalls).to.deep.equal([undefined]);
    expect(request.user).to.deep.equal({
      name: 'admin',
      group: 'administrator',
    });
  });

  it('skips non-handshake engine requests and reuses engine-authenticated users in socket middleware', () => {
    const engineCalls = [];
    createSocketJwtEngineMiddleware({
      jwtSecret: 'secret',
      toSocketAdminUser: payload => payload,
      jwtImpl: {
        verify: () => {
          throw new Error('should not verify non-handshake requests');
        },
      },
    })({ _query: { sid: 'existing-session' }, headers: {} }, {}, err => engineCalls.push(err));

    const socketCalls = [];
    createSocketAuthMiddleware({
      jwtSecret: 'secret',
      toSocketAdminUser: payload => payload,
      jwtImpl: {
        verify: () => {
          throw new Error('should not verify already-authenticated sockets');
        },
      },
    })({ request: { user: { name: 'admin' } }, handshake: {} }, err => socketCalls.push(err));

    expect(engineCalls).to.deep.equal([undefined]);
    expect(socketCalls).to.deep.equal([undefined]);
  });
});
