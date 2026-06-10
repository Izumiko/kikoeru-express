process.env.FREEZE_CONFIG_FILE = true;
process.env.NODE_ENV = 'test';

const chai = require('chai');
const expect = chai.expect;

const { createApp } = require('../app-factory');
const { request } = require('./helpers/http');
const { config } = require('../config');
const db = require('../database/db');

const createWorksQuery = works => {
  const query = {
    count: () => Promise.resolve([{ count: works.length }]),
    offset: () => query,
    limit: () => query,
    orderBy: () => query,
    then: resolve => Promise.resolve(works).then(resolve),
  };

  return query;
};

const createWorkRecord = values => ({
  id: 1,
  title: 'work',
  nsfw: false,
  userRating: null,
  progress: null,
  circleObj: JSON.stringify({ id: 1, name: 'circle' }),
  rate_count_detail: JSON.stringify({ 5: 1 }),
  rank: null,
  vaObj: JSON.stringify({ vas: [] }),
  tagObj: JSON.stringify({ tags: [] }),
  ...values,
});

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

  it('POST /api/auth/me returns validation errors for invalid login input', async function () {
    const res = await request(app, {
      path: '/api/auth/me',
      method: 'POST',
      body: {
        name: 'adm',
        password: 'bad',
      },
    });

    expect(res.statusCode).to.equal(422);
    expect(res.body.errors).to.be.an('array');
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

  it('GET /api/config/admin returns filtered admin config when auth is disabled', async function () {
    const auth = config.auth;
    config.auth = false;

    try {
      const res = await request(app, { path: '/api/config/admin' });

      expect(res.statusCode).to.equal(200);
      expect(res.body.config).to.be.an('object');
      expect(res.body.config).to.not.have.property('md5secret');
      expect(res.body.config).to.not.have.property('jwtsecret');
      expect(res.body.config).to.have.property('listenPort', config.listenPort);
    } finally {
      config.auth = auth;
    }
  });

  it('PUT /api/config/admin preserves protected config values when auth is disabled', async function () {
    const previous = {
      auth: config.auth,
      production: config.production,
      rewindSeekTime: config.rewindSeekTime,
      md5secret: config.md5secret,
      jwtsecret: config.jwtsecret,
    };
    config.auth = false;

    try {
      const res = await request(app, {
        path: '/api/config/admin',
        method: 'PUT',
        body: {
          config: {
            auth: true,
            production: true,
            rewindSeekTime: 11,
            md5secret: 'changed-md5',
            jwtsecret: 'changed-jwt',
          },
        },
      });

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.deep.equal({ message: '保存成功.' });
      expect(config.auth).to.equal(true);
      expect(config.production).to.equal(previous.production);
      expect(config.rewindSeekTime).to.equal(11);
      expect(config.md5secret).to.equal(previous.md5secret);
      expect(config.jwtsecret).to.equal(previous.jwtsecret);
    } finally {
      config.auth = previous.auth;
      config.production = previous.production;
      config.rewindSeekTime = previous.rewindSeekTime;
      config.md5secret = previous.md5secret;
      config.jwtsecret = previous.jwtsecret;
    }
  });

  it('PUT /api/review returns validation errors for missing work id', async function () {
    const res = await request(app, {
      path: '/api/review',
      method: 'PUT',
      body: {
        rating: 5,
      },
    });

    expect(res.statusCode).to.equal(400);
    expect(res.body.errors).to.be.an('array');
  });

  it('GET /api/tracks validates the work id route parameter', async function () {
    const res = await request(app, { path: '/api/tracks/not-an-id' });

    expect(res.statusCode).to.equal(400);
    expect(res.body.errors).to.be.an('array');
  });

  it('GET /api/media/stream validates media route parameters', async function () {
    const res = await request(app, { path: '/api/media/stream/not-an-id/0' });

    expect(res.statusCode).to.equal(400);
    expect(res.body.errors).to.be.an('array');
  });

  it('GET /api/circles keeps the legacy metadata label route', async function () {
    const getLabels = db.getLabels;
    db.getLabels = field => ({
      orderBy: () => Promise.resolve([{ id: 1, name: `${field}-label` }]),
    });

    try {
      const res = await request(app, { path: '/api/circles' });

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.deep.equal([{ id: 1, name: 'circle-label' }]);
    } finally {
      db.getLabels = getLabels;
    }
  });

  it('GET /api/circles/:id keeps the legacy metadata lookup route', async function () {
    const getMetadata = db.getMetadata;
    db.getMetadata = options => Promise.resolve([{ id: options.ids[0], name: `${options.field}-metadata` }]);

    try {
      const res = await request(app, { path: '/api/circles/1' });

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.deep.equal([{ id: 1, name: 'circle-metadata' }]);
    } finally {
      db.getMetadata = getMetadata;
    }
  });

  it('GET /api/circles/:id/works keeps the legacy metadata works route', async function () {
    const getWorksBy = db.getWorksBy;
    db.getWorksBy = options =>
      createWorksQuery([createWorkRecord({ id: options.id[0], title: `${options.field}-work` })]);

    try {
      const res = await request(app, { path: '/api/circles/1/works' });

      expect(res.statusCode).to.equal(200);
      expect(res.body.works[0]).to.include({ id: 1, title: 'circle-work' });
      expect(res.body.pagination.totalCount).to.equal(1);
    } finally {
      db.getWorksBy = getWorksBy;
    }
  });

  it('GET /api/search keeps the legacy optional keyword route', async function () {
    const getWorksByKeyWord = db.getWorksByKeyWord;
    db.getWorksByKeyWord = options =>
      createWorksQuery([createWorkRecord({ title: `keyword:${options.keyword}` })]);

    try {
      const res = await request(app, { path: '/api/search' });

      expect(res.statusCode).to.equal(200);
      expect(res.body.works[0]).to.include({ id: 1, title: 'keyword:' });
      expect(res.body.pagination.totalCount).to.equal(1);
    } finally {
      db.getWorksByKeyWord = getWorksByKeyWord;
    }
  });
});
