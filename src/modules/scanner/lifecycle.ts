import { SOCKET_EVENTS } from '../socket/events.js';
import type { ScannerEventSender } from './session.js';

type ScannerLifecycleOptions = {
  send: ScannerEventSender;
  destroyDatabase: () => void | Promise<void>;
  exit: (code: number) => void;
  consoleLogger?: Pick<Console, 'log'>;
};

class ScannerLifecycle {
  send: ScannerEventSender;
  destroyDatabase: () => void | Promise<void>;
  exit: (code: number) => void;
  console: Pick<Console, 'log'>;

  constructor({ send, destroyDatabase, exit, consoleLogger = console }: ScannerLifecycleOptions) {
    this.send = send;
    this.destroyDatabase = destroyDatabase;
    this.exit = exit;
    this.console = consoleLogger;
  }

  finish(message: string, exitCode: number | null = null): void {
    this.console.log(` * ${message}`);
    this.send({
      event: SOCKET_EVENTS.SCAN_FINISHED,
      payload: {
        message: message,
      },
    });
    this.destroyDatabase();

    if (exitCode !== null) {
      this.exit(exitCode);
    }
  }
}

export { ScannerLifecycle };
