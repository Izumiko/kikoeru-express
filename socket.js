const path = require('path');
const { Server } = require('socket.io');
const child_process = require('child_process'); // 子进程
const { config } = require('./config');
const { toSocketAdminUser } = require('./src/modules/auth/service.js');
const { createSocketAuthMiddleware, createSocketJwtEngineMiddleware } = require('./src/modules/socket/auth');

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

  let scanner = null;

  // 有新的客户端连接时触发
  io.on('connection', function (socket) {
    // console.log('connection');
    socket.emit('success', {
      message: '成功登录管理后台.',
      user: socket.request.user,
      auth: config.auth,
    });

    // socket.on('disconnect', () => {
    //   console.log('disconnect');
    // });

    socket.on('ON_SCANNER_PAGE', () => {
      if (scanner) {
        // 防止用户在扫描过程中刷新页面
        scanner.send({
          emit: 'SCAN_INIT_STATE',
        });
      }
    });

    socket.on('PERFORM_SCAN', () => {
      if (!scanner) {
        scanner = child_process.fork(path.join(__dirname, './filesystem/scanner.js'), { silent: false }); // 子进程
        scanner.on('exit', code => {
          scanner = null;
          if (code) {
            io.emit('SCAN_ERROR');
          }
        });

        scanner.on('message', m => {
          if (m.event) {
            io.emit(m.event, m.payload);
          }
        });
      }
    });

    socket.on('PERFORM_UPDATE', () => {
      if (!scanner) {
        scanner = child_process.fork(path.join(__dirname, './filesystem/updater.js'), ['--refreshAll'], {
          silent: false,
        }); // 子进程
        scanner.on('exit', code => {
          scanner = null;
          if (code) {
            io.emit('SCAN_ERROR');
          }
        });

        scanner.on('message', m => {
          if (m.event) {
            io.emit(m.event, m.payload);
          }
        });
      }
    });

    socket.on('KILL_SCAN_PROCESS', () => {
      scanner.send({
        exit: 1,
      });
    });

    // 发生错误时触发
    socket.on('error', err => {
      console.error(err);
    });
  });
};

module.exports = initSocket;
