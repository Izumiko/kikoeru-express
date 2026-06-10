// @ts-nocheck
import http from 'http';
import https from 'https';
import fs from 'fs';
import os from 'os';
import { initApp } from '../database/init.js';
import { initSocket } from '../modules/socket/server.js';
import { config } from '../../config.js';
import { createApp } from './factory.js';

const configureUnhandledRejectionCrash = () => {
  // Crash the process on "unhandled promise rejection" when NODE_ENV=test or CRASH_ON_UNHANDLED exists
  if (process.env.NODE_ENV === 'test' || process.env.CRASH_ON_UNHANDLED) {
    process.on('unhandledRejection', (reason, promise) => {
      console.error(new Date().toJSON(), 'Kikoeru log: Unhandled rejection at ', promise, `reason: ${reason}`);
      console.error('Crashing the process because of NODE_ENV or CRASH_ON_UNHANDLED settings');
      process.exit(1);
    });
  }
};

const createServers = ({ app, appConfig = config, httpImpl = http, httpsImpl = https, fsImpl = fs }) => {
  // Create HTTP and HTTPS server
  const server = httpImpl.createServer(app);
  let httpsServer = null;
  let httpsSuccess = false;

  if (appConfig.httpsEnabled) {
    try {
      httpsServer = httpsImpl.createServer(
        {
          key: fsImpl.readFileSync(appConfig.httpsPrivateKey),
          cert: fsImpl.readFileSync(appConfig.httpsCert),
        },
        app
      );
      httpsSuccess = true;
    } catch (err) {
      console.error('HTTPS服务器启动失败，请检查证书位置以及是否文件可读');
      console.error(err);
    }
  }

  return {
    server,
    httpsServer,
    httpsSuccess,
  };
};

const logServerAddresses = ({ server, protocol, localOnly, includeLocalWebUi = false, osImpl = os }) => {
  console.log('Express server started on port %s at %s', server.address().port, server.address().address);
  const nets = localOnly ? [] : osImpl.networkInterfaces();
  console.log('Your machine IP address:');
  [
    ...Object.values(nets),
    [
      {
        address: 'localhost',
        family: 'IPv4',
        internal: false,
      },
    ],
  ].forEach(ifaces => {
    ifaces.forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(' - %s://%s:%s', protocol, iface.address, server.address().port);
      }
    });
  });

  if (includeLocalWebUi) {
    console.log('Local Web UI accessible at: %s://localhost:%s', protocol, server.address().port);
  }
};

const startServer = ({ app = createApp(), appConfig = config, initAppFn = initApp, initSocketFn = initSocket } = {}) => {
  // Initialize database if not exists
  // Init or migrate database and config
  // Note: non-blocking
  initAppFn().catch(err => console.error(err));

  const { server, httpsServer, httpsSuccess } = createServers({ app, appConfig });

  // websocket 握手依赖 http 服务
  initSocketFn(server);
  if (appConfig.httpsEnabled) {
    initSocketFn(httpsServer);
  }

  const listenPort = process.env.PORT || appConfig.listenPort || 8888;
  const localOnly = appConfig.blockRemoteConnection;

  // Note: for some unknown reasons, :: does not always work
  localOnly ? server.listen(listenPort, 'localhost') : server.listen(listenPort);
  if (appConfig.httpsEnabled && httpsSuccess) {
    localOnly ? httpsServer.listen(appConfig.httpsPort, 'localhost') : httpsServer.listen(appConfig.httpsPort);
  }

  server.on('listening', () => {
    logServerAddresses({
      server,
      protocol: 'http',
      localOnly,
      includeLocalWebUi: true,
    });
  });

  if (appConfig.httpsEnabled && httpsSuccess) {
    httpsServer.on('listening', () => {
      logServerAddresses({
        server: httpsServer,
        protocol: 'https',
        localOnly,
      });
    });

    console.log('Local Web UI accessible at: https://localhost:%s', httpsServer.address().port);
  }

  return {
    server,
    httpsServer,
    httpsSuccess,
  };
};

export {
  configureUnhandledRejectionCrash,
  createServers,
  logServerAddresses,
  startServer,
};
