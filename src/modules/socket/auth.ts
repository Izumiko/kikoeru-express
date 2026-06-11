import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import type { AuthUser } from '../auth/service.js';

type JwtVerifier = Pick<typeof jwt, 'verify'>;

type SocketRequest = {
  user?: AuthUser;
  [key: string]: unknown;
};

type SocketLike = {
  handshake?: {
    auth?: {
      token?: string;
    };
    query?: {
      token?: string;
      [key: string]: unknown;
    };
  };
  request?: SocketRequest;
};

type EngineRequestLike = {
  _query?: {
    sid?: string;
    [key: string]: unknown;
  };
  headers?: {
    authorization?: string;
    [key: string]: unknown;
  };
  user?: AuthUser;
};

type NextCallback = (err?: Error) => void;

type VerifyAdminTokenOptions = {
  token: string | null | undefined;
  jwtSecret: string;
  toSocketAdminUser: (payload: JwtPayload | AuthUser) => AuthUser;
  jwtImpl: JwtVerifier;
};

type SocketAuthMiddlewareOptions = Omit<VerifyAdminTokenOptions, 'token' | 'jwtImpl'> & {
  jwtImpl?: JwtVerifier;
};

const extractBearerToken = (header: unknown): string | null => {
  if (!header || typeof header !== 'string') {
    return null;
  }

  if (!header.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return header.substring(7);
};

const extractSocketToken = (socket: SocketLike): string | undefined => {
  const handshake = socket.handshake || {};

  if (handshake.auth && handshake.auth.token) {
    return handshake.auth.token;
  }

  // 兼容旧前端可能通过 query 传 token 的连接方式。
  return handshake.query && handshake.query.token;
};

const verifyAdminToken = ({ token, jwtSecret, toSocketAdminUser, jwtImpl }: VerifyAdminTokenOptions): AuthUser => {
  if (!token) {
    throw new Error('Authentication error');
  }

  const payload = jwtImpl.verify(token, jwtSecret) as JwtPayload | AuthUser;
  const user = toSocketAdminUser(payload);

  if (user.name !== 'admin') {
    throw new Error('只有 admin 账号能登录管理后台.');
  }

  return user;
};

const createSocketAuthMiddleware =
  ({ jwtSecret, toSocketAdminUser, jwtImpl = jwt }: SocketAuthMiddlewareOptions) =>
  (socket: SocketLike, next: NextCallback): void => {
  if (socket.request && socket.request.user) {
    next();
    return;
  }

  try {
    const user = verifyAdminToken({
      token: extractSocketToken(socket),
      jwtSecret,
      toSocketAdminUser,
      jwtImpl,
    });
    socket.request = socket.request || {};
    socket.request.user = user;
    next();
  } catch (err: unknown) {
    next(err instanceof Error ? err : new Error(String(err)));
  }
};

const createSocketJwtEngineMiddleware =
  ({ jwtSecret, toSocketAdminUser, jwtImpl = jwt }: SocketAuthMiddlewareOptions) =>
  (req: EngineRequestLike, res: unknown, next: NextCallback): void => {
  const isHandshake = req._query && req._query.sid === undefined;
  if (!isHandshake) {
    next();
    return;
  }

  try {
    req.user = verifyAdminToken({
      token: extractBearerToken(req.headers && req.headers.authorization),
      jwtSecret,
      toSocketAdminUser,
      jwtImpl,
    });
    next();
  } catch (err: unknown) {
    next(err instanceof Error ? err : new Error(String(err)));
  }
};

export {
  createSocketJwtEngineMiddleware,
  createSocketAuthMiddleware,
  extractBearerToken,
  extractSocketToken,
  verifyAdminToken,
};
