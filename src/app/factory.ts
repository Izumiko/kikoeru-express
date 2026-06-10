// @ts-nocheck
import path from 'path';
import express from 'express';
import compression from 'compression';
import history from 'connect-history-api-fallback';
import serveIndex from 'serve-index';
import { config } from '../../config.js';
import { runtimeBaseDir } from '../../config.js';
import api from '../api/mount.js';
const createApp = () => {
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

  // connect-history-api-fallback 必须放在静态资源之前，保证静态资源优先，其他全部回到 index.html
  app.use(
    history({
      rewrites: [
        {
          from: /^\/api\/.*$/,
          to: context => context.parsedUrl.path,
        },
      ],
      index: '/index.html',
      verbose: false,
    })
  );
  // Serve WebApp routes
  app.use(express.static(path.join(runtimeBaseDir, 'dist')));
  // Expose API routes
  api(app);

  // 返回错误响应
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
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
  });

  return app;
};

export { createApp };
