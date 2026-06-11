import path from 'path';
import type { ForkScannerProcess } from './scanner-process-controller.js';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import childProcess from 'child_process'; // 子进程
import { config } from '../../../config.js';
import type { AppConfig } from '../../config/types.js';
import { toSocketAdminUser } from '../auth/service.js';
import { createSocketAuthMiddleware, createSocketJwtEngineMiddleware } from './auth.js';
import { createScannerSocketGateway } from './scanner-gateway.js';
import type { ScannerGatewayIo } from './scanner-gateway.js';

type SocketServerLike = ScannerGatewayIo & {
  engine: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    use: (middleware: (...args: any[]) => void) => unknown;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  use: (middleware: (...args: any[]) => void) => unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SocketServerConstructor = new (...args: any[]) => SocketServerLike;

type SocketServerConfig = Pick<AppConfig, 'auth' | 'jwtsecret'>;

type SocketServerOptions = {
  server: unknown;
  ServerImpl?: SocketServerConstructor;
  childProcessImpl?: {
    fork: ForkScannerProcess;
  };
  appConfig?: SocketServerConfig;
  rootDir?: string;
};

const DefaultSocketServer = Server as unknown as SocketServerConstructor;

const getDefaultCliRootDir = () => path.dirname(fileURLToPath(import.meta.url));

const resolveScannerScriptPaths = (rootDir: string) => ({
  scannerScriptPath: path.join(rootDir, 'scanner.js'),
  updaterScriptPath: path.join(rootDir, 'updater.js'),
});

const createSocketServer = ({
  server,
  ServerImpl = DefaultSocketServer,
  childProcessImpl = childProcess,
  appConfig = config,
  rootDir = getDefaultCliRootDir(),
}: SocketServerOptions) => {
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

const initSocket = (server: unknown) =>
  createSocketServer({
    server,
  });

export {
  createSocketServer,
  getDefaultCliRootDir,
  initSocket,
  resolveScannerScriptPaths,
};
export type {
  SocketServerConfig,
  SocketServerConstructor,
  SocketServerLike,
  SocketServerOptions,
};
