// @ts-nocheck
import jwt from 'jsonwebtoken';
const extractBearerToken = header => {
  if (!header || typeof header !== 'string') {
    return null;
  }

  if (!header.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return header.substring(7);
};

const extractSocketToken = socket => {
  const handshake = socket.handshake || {};

  if (handshake.auth && handshake.auth.token) {
    return handshake.auth.token;
  }

  // 兼容旧前端可能通过 query 传 token 的连接方式。
  return handshake.query && handshake.query.token;
};

const verifyAdminToken = ({ token, jwtSecret, toSocketAdminUser, jwtImpl }) => {
  if (!token) {
    throw new Error('Authentication error');
  }

  const payload = jwtImpl.verify(token, jwtSecret);
  const user = toSocketAdminUser(payload);

  if (user.name !== 'admin') {
    throw new Error('只有 admin 账号能登录管理后台.');
  }

  return user;
};

const createSocketAuthMiddleware = ({ jwtSecret, toSocketAdminUser, jwtImpl = jwt }) => (socket, next) => {
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
  } catch (err) {
    next(err);
  }
};

const createSocketJwtEngineMiddleware = ({ jwtSecret, toSocketAdminUser, jwtImpl = jwt }) => (req, res, next) => {
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
  } catch (err) {
    next(err);
  }
};

export {
  createSocketJwtEngineMiddleware,
  createSocketAuthMiddleware,
  extractBearerToken,
  extractSocketToken,
  verifyAdminToken,
};
