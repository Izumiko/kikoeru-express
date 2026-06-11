import path from 'path';
import express from 'express';
import type { ErrorRequestHandler, Express, RequestHandler } from 'express';
import compression from 'compression';
import serveIndexFactory from 'serve-index';
const serveIndex = serveIndexFactory as (path: string, options?: { icons?: boolean }) => RequestHandler;
import { config } from '../config/index.js';
import { runtimeBaseDir } from '../config/index.js';
import api from '../api/mount.js';

type HttpError = Error & {
  code?: string;
};

const createApp = (): Express => {
  const app = express();

  if (config.behindProxy) {
    // Only useful if you are using a reverse proxy e.g. nginx
    // This is used to detect correct remote IP address which will be used in express-brute and some routes
    // You MUST set a X-Forwarded-For header in your reverse proxy to make it work
    // By default, behindProxy is false
    app.set('trust proxy', 'loopback');
  }

  if (config.enableGzip) {
    app.use(compression());
  }

  // parse application/x-www-form-urlencoded
  app.use(express.urlencoded({ extended: true }));
  // parse application/json
  app.use(express.json());

  // For dev purpose only
  if (process.env.NODE_ENV === 'development') {
    app.use('/media/stream/VoiceWork', express.static('VoiceWork'), serveIndex('VoiceWork', { icons: true }));
    app.use('/media/download/VoiceWork', express.static('VoiceWork'), serveIndex('VoiceWork', { icons: true }));
  }

  // 首先挂载 API 路由
  api(app);

  // 其次挂载静态资源
  app.use(express.static(path.join(runtimeBaseDir, 'dist')));

  // 最后使用原生中间件实现 SPA 路由兜底
  app.use((req, res, next) => {
    // 只有 GET 请求才可能是页面导航
    if (req.method !== 'GET') {
      return next();
    }

    // 排除 API 路由
    if (req.path.startsWith('/api/')) {
      return next();
    }

    // 排除带有扩展名的资源请求 (Dot Rule)
    if (req.path.includes('.')) {
      return next();
    }

    // 确认请求接受 HTML
    const accept = req.headers.accept || '';
    if (accept.includes('text/html') || accept.includes('*/*')) {
      res.sendFile(path.join(runtimeBaseDir, 'dist', 'index.html'));
    } else {
      next();
    }
  });

  // 返回错误响应

  const errorHandler: ErrorRequestHandler = (err: HttpError, req, res, _next) => {
    if (err.name === 'UnauthorizedError') {
      // 验证错误
      res.set('WWW-Authenticate', 'Bearer realm="Authorization Required"');
      res.status(401).send({ error: err.message });
    } else if (err.code === 'SQLITE_ERROR') {
      if (err.message.indexOf('no such table') !== -1) {
        res.status(500).send({ error: '数据库结构尚未建立，请先执行扫描.' });
      }
    } else {
      console.error(new Date().toJSON(), 'Kikoeru log:', err);
      if (process.env.NODE_ENV === 'production' || config.production) {
        // Do not send excess error messages to the client on production mode
        res.status(500).send({ error: '服务器错误' });
      } else {
        res.status(500).send({ error: err.message || err });
      }
    }
  };
  app.use(errorHandler);

  return app;
};

export { createApp };
