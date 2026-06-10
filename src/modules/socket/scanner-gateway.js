const { SOCKET_EVENTS } = require('./events');
const { createScannerProcessController } = require('./scanner-process-controller');

const createScannerSocketGateway = ({
  io,
  fork,
  scannerScriptPath,
  updaterScriptPath,
  config,
  scannerController =
    createScannerProcessController({
      fork,
      scannerScriptPath,
      updaterScriptPath,
      emit: (event, payload) => io.emit(event, payload),
    }),
  consoleLogger = console,
}) => {

  const bindSocket = socket => {
    socket.emit(SOCKET_EVENTS.SUCCESS, {
      message: '成功登录管理后台.',
      user: socket.request.user,
      auth: config.auth,
    });

    socket.on(SOCKET_EVENTS.ON_SCANNER_PAGE, () => {
      // 防止用户在扫描过程中刷新页面
      scannerController.requestInitState();
    });

    socket.on(SOCKET_EVENTS.PERFORM_SCAN, () => {
      scannerController.startScan();
    });

    socket.on(SOCKET_EVENTS.PERFORM_UPDATE, () => {
      scannerController.startUpdate();
    });

    socket.on(SOCKET_EVENTS.KILL_SCAN_PROCESS, () => {
      scannerController.kill();
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
  };
};

module.exports = {
  createScannerSocketGateway,
};
