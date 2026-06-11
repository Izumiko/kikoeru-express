import { expect } from 'vitest';
import jwt from 'jsonwebtoken';
import authService from '../src/modules/auth/service.js';
import { config } from '../config.js';

describe('Auth service', function () {
  it('verifies legacy md5 password hashes', function () {
    const passwordHash = authService.hashLegacyPassword('password');

    expect(authService.verifyPassword('password', passwordHash)).to.equal(true);
    expect(authService.verifyPassword('wrong-password', passwordHash)).to.equal(false);
    expect(authService.shouldUpgradePasswordHash(passwordHash)).to.equal(true);
  });

  it('verifies modern scrypt password hashes', function () {
    const passwordHash = authService.hashPassword('password');

    expect(authService.isModernPasswordHash(passwordHash)).to.equal(true);
    expect(authService.verifyPassword('password', passwordHash)).to.equal(true);
    expect(authService.verifyPassword('wrong-password', passwordHash)).to.equal(false);
    expect(authService.shouldUpgradePasswordHash(passwordHash)).to.equal(false);
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
