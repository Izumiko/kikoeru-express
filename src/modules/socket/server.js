const path = require('path');
const { Server } = require('socket.io');
const childProcess = require('child_process'); // 子进程
const { config } = require('../../../config');
const { toSocketAdminUser } = require('../auth/service.js');
const { createSocketAuthMiddleware, createSocketJwtEngineMiddleware } = require('./auth');
const { createScannerSocketGateway } = require('./scanner-gateway');

const createSocketServer = ({
  server,
  ServerImpl = Server,
  childProcessImpl = childProcess,
  appConfig = config,
  rootDir = path.join(__dirname, '../../..'),
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

  createScannerSocketGateway({
    io,
    fork: childProcessImpl.fork,
    scannerScriptPath: path.join(rootDir, './filesystem/scanner.js'),
    updaterScriptPath: path.join(rootDir, './filesystem/updater.js'),
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
  initSocket,
};
