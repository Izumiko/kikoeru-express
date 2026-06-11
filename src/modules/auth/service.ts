import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { JwtPayload, SignOptions } from 'jsonwebtoken';
import type { Request } from 'express';
import type { Params } from 'express-jwt';
import { config } from '../../../config.js';

const issuer = 'http://kikoeru';
const audience = 'http://kikoeru/api';
const bcryptPrefix = '$2';
const bcryptRounds = 12;
const jwtAlgorithm = 'HS256' as const;

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

const hashPassword = (password: string): string => bcrypt.hashSync(password, bcryptRounds);

const isModernPasswordHash = (passwordHash: unknown): passwordHash is string =>
  typeof passwordHash === 'string' && passwordHash.startsWith(bcryptPrefix);

const verifyPassword = (password: string, passwordHash: string): boolean => {
  if (isModernPasswordHash(passwordHash)) {
    return bcrypt.compareSync(password, passwordHash);
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
