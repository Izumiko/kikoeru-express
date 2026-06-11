import http from 'http';
import https from 'https';
import fs from 'fs';
import os from 'os';
import type { Express } from 'express';
import type { AddressInfo } from 'net';
import { initApp } from '../database/init.js';
import { initSocket } from '../modules/socket/server.js';
import { config } from '../../config.js';
import type { AppConfig } from '../config/types.js';
import { createApp } from './factory.js';

const configureUnhandledRejectionCrash = (): void => {
  // Crash the process on "unhandled promise rejection" when NODE_ENV=test or CRASH_ON_UNHANDLED exists
  if (process.env.NODE_ENV === 'test' || process.env.CRASH_ON_UNHANDLED) {
    process.on('unhandledRejection', (reason, promise) => {
      console.error(new Date().toJSON(), 'Kikoeru log: Unhandled rejection at ', promise, `reason: ${reason}`);
      console.error('Crashing the process because of NODE_ENV or CRASH_ON_UNHANDLED settings');
      process.exit(1);
    });
  }
};

type HttpServer = ReturnType<typeof http.createServer>;
type HttpsServer = ReturnType<typeof https.createServer>;

type CreateServersOptions = {
  app: Express;
  appConfig?: AppConfig;
  httpImpl?: typeof http;
  httpsImpl?: typeof https;
  fsImpl?: Pick<typeof fs, 'readFileSync'>;
};

type CreatedServers = {
  server: HttpServer;
  httpsServer: HttpsServer | null;
  httpsSuccess: boolean;
};

const createServers = ({
  app,
  appConfig = config,
  httpImpl = http,
  httpsImpl = https,
  fsImpl = fs,
}: CreateServersOptions): CreatedServers => {
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

type LogServerAddressOptions = {
  server: HttpServer | HttpsServer;
  protocol: 'http' | 'https';
  localOnly: boolean;
  includeLocalWebUi?: boolean;
  osImpl?: Pick<typeof os, 'networkInterfaces'>;
};

const getAddressInfo = (server: HttpServer | HttpsServer): AddressInfo => server.address() as AddressInfo;

const logServerAddresses = ({
  server,
  protocol,
  localOnly,
  includeLocalWebUi = false,
  osImpl = os,
}: LogServerAddressOptions): void => {
  const address = getAddressInfo(server);
  console.log('Express server started on port %s at %s', address.port, address.address);
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
    (ifaces || []).forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(' - %s://%s:%s', protocol, iface.address, address.port);
      }
    });
  });

  if (includeLocalWebUi) {
    console.log('Local Web UI accessible at: %s://localhost:%s', protocol, address.port);
  }
};

type StartServerOptions = {
  app?: Express;
  appConfig?: AppConfig;
  initAppFn?: () => Promise<void>;
  initSocketFn?: (server: HttpServer | HttpsServer) => unknown;
};

const startServer = ({
  app = createApp(),
  appConfig = config,
  initAppFn = initApp,
  initSocketFn = initSocket,
}: StartServerOptions = {}): CreatedServers => {
  // Initialize database if not exists
  // Init or migrate database and config
  // Note: non-blocking
  initAppFn().catch(err => console.error(err));

  const { server, httpsServer, httpsSuccess } = createServers({ app, appConfig });

  // websocket 握手依赖 http 服务
  initSocketFn(server);
  if (appConfig.httpsEnabled && httpsServer) {
    initSocketFn(httpsServer);
  }

  const listenPort = Number(process.env.PORT || appConfig.listenPort || 8888);
  const localOnly = appConfig.blockRemoteConnection;

  // Note: for some unknown reasons, :: does not always work
  if (localOnly) {
    server.listen(listenPort, 'localhost');
  } else {
    server.listen(listenPort);
  }
  if (appConfig.httpsEnabled && httpsSuccess) {
    if (localOnly) {
      httpsServer?.listen(appConfig.httpsPort, 'localhost');
    } else {
      httpsServer?.listen(appConfig.httpsPort);
    }
  }

  server.on('listening', () => {
    logServerAddresses({
      server,
      protocol: 'http',
      localOnly,
      includeLocalWebUi: true,
    });
  });

  if (appConfig.httpsEnabled && httpsSuccess && httpsServer) {
    httpsServer.on('listening', () => {
      logServerAddresses({
        server: httpsServer,
        protocol: 'https',
        localOnly,
      });
    });

    console.log('Local Web UI accessible at: https://localhost:%s', getAddressInfo(httpsServer).port);
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
