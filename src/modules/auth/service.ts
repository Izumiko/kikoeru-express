import { createHash, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { JwtPayload, SignOptions } from 'jsonwebtoken';
import type { Request } from 'express';
import type { Params } from 'express-jwt';
import { config } from '../../config/index.js';

const issuer = 'http://kikoeru';
const audience = 'http://kikoeru/api';
const scryptPrefix = 'scrypt$';
const jwtAlgorithm = 'HS256' as const;
const scryptKeylen = 64;

type AuthUser = {
  name: string;
  group: string;
};

type KikoeruJwtPayload = JwtPayload & AuthUser;

type TokenGetter = (req: Request) => string | undefined;

const signPayload = (payload: KikoeruJwtPayload): string =>
  jwt.sign(payload, config.jwtsecret, { expiresIn: config.expiresIn } as SignOptions);

const signToken = (user: AuthUser): string => {
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

const hashLegacyPassword = (password: string): string =>
  createHash('md5')
    .update(password + config.md5secret)
    .digest('hex');

const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, scryptKeylen).toString('hex');
  return `${scryptPrefix}${salt}$${hash}`;
};

const isModernPasswordHash = (passwordHash: unknown): passwordHash is string =>
  typeof passwordHash === 'string' && passwordHash.startsWith(scryptPrefix);

const verifyScryptPassword = (password: string, passwordHash: string): boolean => {
  const parts = passwordHash.slice(scryptPrefix.length).split('$');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const expectedHash = scryptSync(password, salt, scryptKeylen);
  const actualHash = Buffer.from(hash, 'hex');
  if (expectedHash.length !== actualHash.length) return false;
  return timingSafeEqual(expectedHash, actualHash);
};

const verifyPassword = (password: string, passwordHash: string): boolean => {
  if (isModernPasswordHash(passwordHash)) {
    return verifyScryptPassword(password, passwordHash);
  }

  return passwordHash === hashLegacyPassword(password);
};

const shouldUpgradePasswordHash = (passwordHash: string): boolean => !isModernPasswordHash(passwordHash);

const getHttpJwtOptions = (getToken: TokenGetter): Params => ({
  secret: config.jwtsecret,
  audience,
  issuer,
  getToken,
  algorithms: [jwtAlgorithm],
});

const getRouteJwtOptions = (): Params => ({
  secret: config.jwtsecret,
  algorithms: [jwtAlgorithm],
});

const getSocketJwtOptions = (): { secret: string } => ({
  secret: config.jwtsecret,
});

const toSocketAdminUser = (payload: JwtPayload | AuthUser): AuthUser => ({
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
export type { AuthUser, KikoeruJwtPayload, TokenGetter };

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
