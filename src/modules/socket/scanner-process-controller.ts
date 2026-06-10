// @ts-nocheck
import { SOCKET_EVENTS } from './events.js';

const createScannerProcessController = ({ fork, scannerScriptPath, updaterScriptPath, emit }) => {
  let scanner = null;

  const bindScannerEvents = () => {
    scanner.on('exit', code => {
      scanner = null;
      if (code) {
        emit(SOCKET_EVENTS.SCAN_ERROR);
      }
    });

    scanner.on('message', message => {
      if (message.event) {
        emit(message.event, message.payload);
      }
    });
  };

  const startProcess = (scriptPath, args = []) => {
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
    scanner.send({
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

export {
  createScannerProcessController,
};
