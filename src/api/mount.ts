import { expressjwt as expressJwt } from 'express-jwt'; // 把 JWT 的 payload 部分赋值于 req.user
import type { Application, Request } from 'express';
import type { Params } from 'express-jwt';
import { config } from '../config/index.js';
import routes from './routes.js';
import { getHttpJwtOptions } from '../modules/auth/service.js';

/**
 * Get token from header or query string.
 */
const getToken = (req: Request): string | undefined => {
  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    return req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    return req.query.token as string;
  }
  return undefined;
};

const mountApi = (app: Application): void => {
  if (config.auth) {
    // expressJwt 中间件
    // 验证指定 http 请求的 JsonWebTokens 的有效性, 如果有效就将 JsonWebTokens 的值设置到 req.user 里面, 然后路由到相应的 router
    app.use(
      '/api',
      expressJwt(getHttpJwtOptions(getToken) as Params).unless({ path: ['/api/auth/me', '/api/health'] })
    );
  }

  app.use('/api', routes);
};

export default mountApi;
export { getToken };
