const { SOCKET_EVENTS } = require('./events');

const createScannerSocketGateway = ({ io, fork, scannerScriptPath, updaterScriptPath, config, consoleLogger = console }) => {
  let scanner = null;

  const forwardScannerEvents = () => {
    scanner.on('exit', code => {
      scanner = null;
      if (code) {
        io.emit(SOCKET_EVENTS.SCAN_ERROR);
      }
    });

    scanner.on('message', message => {
      if (message.event) {
        io.emit(message.event, message.payload);
      }
    });
  };

  const startScannerProcess = (scriptPath, args = []) => {
    if (scanner) {
      return;
    }

    scanner = fork(scriptPath, args, { silent: false }); // 子进程
    forwardScannerEvents();
  };

  const bindSocket = socket => {
    socket.emit(SOCKET_EVENTS.SUCCESS, {
      message: '成功登录管理后台.',
      user: socket.request.user,
      auth: config.auth,
    });

    socket.on(SOCKET_EVENTS.ON_SCANNER_PAGE, () => {
      if (scanner) {
        // 防止用户在扫描过程中刷新页面
        scanner.send({
          emit: SOCKET_EVENTS.SCAN_INIT_STATE,
        });
      }
    });

    socket.on(SOCKET_EVENTS.PERFORM_SCAN, () => {
      startScannerProcess(scannerScriptPath);
    });

    socket.on(SOCKET_EVENTS.PERFORM_UPDATE, () => {
      startScannerProcess(updaterScriptPath, ['--refreshAll']);
    });

    socket.on(SOCKET_EVENTS.KILL_SCAN_PROCESS, () => {
      scanner.send({
        exit: 1,
      });
    });

    // 发生错误时触发
    socket.on('error', err => {
      consoleLogger.error(err);
    });
  };

  const bind = () => {
    // 有新的客户端连接时触发
    io.on('connection', bindSocket);
  };

  return {
    bind,
    bindSocket,
    startScannerProcess,
  };
};

module.exports = {
  createScannerSocketGateway,
};
