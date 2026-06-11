import type { ForkOptions } from 'child_process';
import { SOCKET_EVENTS } from './events.js';
import type { SocketEventName } from './events.js';

type ScannerChildProcess = {
  on(event: 'exit', handler: (code: number | null) => void): void;
  on(event: 'message', handler: (message: ScannerProcessMessage) => void): void;
  send: (message: ScannerProcessCommand) => unknown;
};

type ScannerProcessMessage = {
  event?: SocketEventName;
  payload?: unknown;
};

type ScannerProcessCommand =
  | {
      emit: typeof SOCKET_EVENTS.SCAN_INIT_STATE;
    }
  | {
      exit: 1;
    };

type ForkScannerProcess = (scriptPath: string, args?: string[], options?: ForkOptions) => ScannerChildProcess;

type ScannerProcessControllerOptions = {
  fork: ForkScannerProcess;
  scannerScriptPath: string;
  updaterScriptPath: string;
  emit: (event: SocketEventName, payload?: unknown) => void;
};

const createScannerProcessController = ({
  fork,
  scannerScriptPath,
  updaterScriptPath,
  emit,
}: ScannerProcessControllerOptions) => {
  let scanner: ScannerChildProcess | null = null;

  const bindScannerEvents = () => {
    scanner!.on('exit', (code) => {
      scanner = null;
      if (code) {
        emit(SOCKET_EVENTS.SCAN_ERROR);
      }
    });

    scanner!.on('message', (message) => {
      if (message.event) {
        emit(message.event, message.payload);
      }
    });
  };

  const startProcess = (scriptPath: string, args: string[] = []) => {
    if (scanner) {
      return;
    }

    scanner = fork(scriptPath, args, { silent: false }); // 子进程
    bindScannerEvents();
  };

  const startScan = () => startProcess(scannerScriptPath);

  const startUpdate = () => startProcess(updaterScriptPath, ['--refreshAll']);

  const requestInitState = () => {
    if (scanner) {
      scanner.send({
        emit: SOCKET_EVENTS.SCAN_INIT_STATE,
      });
    }
  };

  const kill = () => {
    scanner?.send({
      exit: 1,
    });
  };

  return {
    kill,
    requestInitState,
    startScan,
    startUpdate,
  };
};

export { createScannerProcessController };
export type { ForkScannerProcess, ScannerChildProcess, ScannerProcessControllerOptions };
