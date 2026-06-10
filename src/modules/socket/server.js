const path = require('path');
const { Server } = require('socket.io');
const childProcess = require('child_process'); // 子进程
const { config } = require('../../../config');
const { toSocketAdminUser } = require('../auth/service.js');
const { createSocketAuthMiddleware, createSocketJwtEngineMiddleware } = require('./auth');
const { createScannerSocketGateway } = require('./scanner-gateway');

const getDefaultCliRootDir = () => path.dirname(require.main ? require.main.filename : process.cwd());

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

module.exports = {
  createSocketServer,
  getDefaultCliRootDir,
  initSocket,
  resolveScannerScriptPaths,
};
