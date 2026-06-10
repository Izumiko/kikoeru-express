// @ts-nocheck
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import childProcess from 'child_process'; // 子进程
import { config } from '../../../config.js';
import { toSocketAdminUser } from '../auth/service.js';
import { createSocketAuthMiddleware, createSocketJwtEngineMiddleware } from './auth.js';
import { createScannerSocketGateway } from './scanner-gateway.js';

const getDefaultCliRootDir = () => path.dirname(fileURLToPath(import.meta.url));

const resolveScannerScriptPaths = rootDir => ({
  scannerScriptPath: path.join(rootDir, 'scanner.js'),
  updaterScriptPath: path.join(rootDir, 'updater.js'),
});

const createSocketServer = ({
  server,
  ServerImpl = Server,
  childProcessImpl = childProcess,
  appConfig = config,
  rootDir = getDefaultCliRootDir(),
}) => {
  const io = new ServerImpl(server);
  if (appConfig.auth) {
    io.engine.use(
      createSocketJwtEngineMiddleware({
        jwtSecret: appConfig.jwtsecret,
        toSocketAdminUser,
      })
    );
    io.use(
      createSocketAuthMiddleware({
        jwtSecret: appConfig.jwtsecret,
        toSocketAdminUser,
      })
    );
  }

  const { scannerScriptPath, updaterScriptPath } = resolveScannerScriptPaths(rootDir);
  createScannerSocketGateway({
    io,
    fork: childProcessImpl.fork,
    scannerScriptPath,
    updaterScriptPath,
    config: appConfig,
  }).bind();

  return io;
};

const initSocket = server =>
  createSocketServer({
    server,
  });

export {
  createSocketServer,
  getDefaultCliRootDir,
  initSocket,
  resolveScannerScriptPaths,
};
