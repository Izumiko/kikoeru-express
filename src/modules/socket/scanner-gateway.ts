import type { AuthUser } from '../auth/service.js';
import { SOCKET_EVENTS } from './events.js';
import type { SocketEventName } from './events.js';
import { createScannerProcessController } from './scanner-process-controller.js';
import type { ForkScannerProcess } from './scanner-process-controller.js';

type ScannerController = {
  kill: () => void;
  requestInitState: () => void;
  startScan: () => void;
  startUpdate: () => void;
};

type ScannerGatewayIo = {
  emit: (event: SocketEventName, payload?: unknown) => unknown;
  on: (event: 'connection', handler: (socket: ScannerGatewaySocket) => void) => unknown;
};

type ScannerGatewaySocket = {
  request: {
    user?: AuthUser;
    [key: string]: unknown;
  };
  emit: (event: typeof SOCKET_EVENTS.SUCCESS, payload: ScannerSuccessPayload) => unknown;
  on: (event: SocketEventName | 'error', handler: (...args: unknown[]) => void) => unknown;
};

type ScannerGatewayConfig = {
  auth: boolean;
};

type ScannerSuccessPayload = {
  message: string;
  user?: AuthUser;
  auth: boolean;
};

type ScannerSocketGatewayOptions = {
  io: ScannerGatewayIo;
  fork: ForkScannerProcess;
  scannerScriptPath: string;
  updaterScriptPath: string;
  config: ScannerGatewayConfig;
  scannerController?: ScannerController;
  consoleLogger?: Pick<Console, 'error'>;
};

const createScannerSocketGateway = ({
  io,
  fork,
  scannerScriptPath,
  updaterScriptPath,
  config,
  scannerController = createScannerProcessController({
    fork,
    scannerScriptPath,
    updaterScriptPath,
    emit: (event, payload) => io.emit(event, payload),
  }),
  consoleLogger = console,
}: ScannerSocketGatewayOptions) => {
  const bindSocket = (socket: ScannerGatewaySocket) => {
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
    socket.on('error', (err) => {
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

export { createScannerSocketGateway };
export type {
  ScannerController,
  ScannerGatewayConfig,
  ScannerGatewayIo,
  ScannerGatewaySocket,
  ScannerSocketGatewayOptions,
  ScannerSuccessPayload,
};
