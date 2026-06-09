/* eslint-disable node/no-unpublished-require */
process.env.FREEZE_CONFIG_FILE = true;
process.env.NODE_ENV = 'test';

const chai = require('chai');
const expect = chai.expect;

const { createApp } = require('../app-factory');
const { request } = require('./helpers/http');
const { config } = require('../config');

describe('API contract', function () {
  let app;

  before(function () {
    app = createApp();
  });

  it('GET /api/health returns the legacy OK response', async function () {
    const res = await request(app, { path: '/api/health' });

    expect(res.statusCode).to.equal(200);
    expect(res.text).to.equal('OK');
  });

  it('GET /api/auth/me returns the default unauthenticated admin contract when auth is disabled', async function () {
    const auth = config.auth;
    config.auth = false;

    try {
      const res = await request(app, { path: '/api/auth/me' });

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.deep.equal({
        user: {
          name: 'admin',
          group: 'administrator',
        },
        auth: false,
      });
    } finally {
      config.auth = auth;
    }
  });

  it('GET /api/config/shared returns the public playback config contract', async function () {
    const res = await request(app, { path: '/api/config/shared' });

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.deep.equal({
      sharedConfig: {
        rewindSeekTime: config.rewindSeekTime,
        forwardSeekTime: config.forwardSeekTime,
      },
    });
  });
});
