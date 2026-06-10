// @ts-nocheck
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import legacyMd5 from 'md5';
import { config } from '../../../config.js';

const issuer = 'http://kikoeru';
const audience = 'http://kikoeru/api';
const bcryptPrefix = '$2';
const bcryptRounds = 12;

const signPayload = payload => jwt.sign(payload, config.jwtsecret, { expiresIn: config.expiresIn });

const signToken = user => {
  // RFC 7519
  const payload = {
    iss: issuer,
    sub: user.name,
    aud: audience,
    name: user.name,
    group: user.group,
  };
  return signPayload(payload);
};

const hashLegacyPassword = password => legacyMd5(password + config.md5secret);

const hashPassword = password => bcrypt.hashSync(password, bcryptRounds);

const isModernPasswordHash = passwordHash => typeof passwordHash === 'string' && passwordHash.startsWith(bcryptPrefix);

const verifyPassword = (password, passwordHash) => {
  if (isModernPasswordHash(passwordHash)) {
    return bcrypt.compareSync(password, passwordHash);
  }

  return passwordHash === hashLegacyPassword(password);
};

const shouldUpgradePasswordHash = passwordHash => !isModernPasswordHash(passwordHash);

const getHttpJwtOptions = getToken => ({
  secret: config.jwtsecret,
  audience,
  issuer,
  getToken,
  algorithms: ['HS256'],
});

const getRouteJwtOptions = () => ({
  secret: config.jwtsecret,
  algorithms: ['HS256'],
});

const getSocketJwtOptions = () => ({
  secret: config.jwtsecret,
});

const toSocketAdminUser = payload => ({
  name: payload.name,
  group: payload.group,
});

export {
  audience,
  getHttpJwtOptions,
  getRouteJwtOptions,
  getSocketJwtOptions,
  hashLegacyPassword,
  hashPassword,
  isModernPasswordHash,
  issuer,
  shouldUpgradePasswordHash,
  signToken,
  toSocketAdminUser,
  verifyPassword,
};

export default {
  audience,
  getHttpJwtOptions,
  getRouteJwtOptions,
  getSocketJwtOptions,
  hashLegacyPassword,
  hashPassword,
  isModernPasswordHash,
  issuer,
  shouldUpgradePasswordHash,
  signToken,
  toSocketAdminUser,
  verifyPassword,
};
