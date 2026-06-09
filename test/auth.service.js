/* eslint-disable node/no-unpublished-require */
process.env.FREEZE_CONFIG_FILE = true;
process.env.NODE_ENV = 'test';

const chai = require('chai');
const expect = chai.expect;
const jwt = require('jsonwebtoken');

const authService = require('../src/modules/auth/service.js');
const legacyAuthUtils = require('../auth/utils');
const { config } = require('../config');

describe('Auth service', function () {
  it('verifies legacy md5 password hashes', function () {
    const passwordHash = authService.hashLegacyPassword('password');

    expect(authService.verifyPassword('password', passwordHash)).to.equal(true);
    expect(authService.verifyPassword('wrong-password', passwordHash)).to.equal(false);
    expect(authService.shouldUpgradePasswordHash(passwordHash)).to.equal(true);
  });

  it('verifies modern bcrypt password hashes', function () {
    const passwordHash = authService.hashPassword('password');

    expect(authService.isModernPasswordHash(passwordHash)).to.equal(true);
    expect(authService.verifyPassword('password', passwordHash)).to.equal(true);
    expect(authService.verifyPassword('wrong-password', passwordHash)).to.equal(false);
    expect(authService.shouldUpgradePasswordHash(passwordHash)).to.equal(false);
  });

  it('keeps legacy auth utils compatible', function () {
    expect(legacyAuthUtils.md5('password')).to.equal(authService.hashLegacyPassword('password'));
    expect(legacyAuthUtils.issuer).to.equal(authService.issuer);
    expect(legacyAuthUtils.audience).to.equal(authService.audience);
  });

  it('signs the existing JWT payload contract', function () {
    const token = authService.signToken({ name: 'admin', group: 'administrator' });
    const payload = jwt.verify(token, config.jwtsecret, {
      audience: authService.audience,
      issuer: authService.issuer,
      algorithms: ['HS256'],
    });

    expect(payload.sub).to.equal('admin');
    expect(payload.name).to.equal('admin');
    expect(payload.group).to.equal('administrator');
  });
});
