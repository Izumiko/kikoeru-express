const path = require('path');
const { Server } = require('socket.io');
const child_process = require('child_process'); // 子进程
const { config } = require('./config');
const { toSocketAdminUser } = require('./src/modules/auth/service.js');
const { createSocketAuthMiddleware, createSocketJwtEngineMiddleware } = require('./src/modules/socket/auth');
const { createScannerSocketGateway } = require('./src/modules/socket/scanner-gateway');

const initSocket = server => {
  const io = new Server(server);
  if (config.auth) {
    io.engine.use(
      createSocketJwtEngineMiddleware({
        jwtSecret: config.jwtsecret,
        toSocketAdminUser,
      })
    );
    io.use(
      createSocketAuthMiddleware({
        jwtSecret: config.jwtsecret,
        toSocketAdminUser,
      })
    );
  }

  createScannerSocketGateway({
    io,
    fork: child_process.fork,
    scannerScriptPath: path.join(__dirname, './filesystem/scanner.js'),
    updaterScriptPath: path.join(__dirname, './filesystem/updater.js'),
    config,
  }).bind();
};

module.exports = initSocket;
