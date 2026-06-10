import type { ScanSession, ScannerLog } from './session.js';

type ScannerConsole = Pick<Console, 'log'>;

class ScannerLogger {
  session: ScanSession;
  console: ScannerConsole;

  constructor(session: ScanSession, consoleLogger: ScannerConsole = console) {
    this.session = session;
    this.console = consoleLogger;
  }

  emitMainLog(message: string, level = 'info', truncate = 3): void {
    this.console.log(message);
    this.session.addMainLog({
      level: level,
      message: message.substring(truncate),
    } satisfies ScannerLog);
  }

  emitTaskLog(message: string, rjcode: string | number, level = 'info', truncate = 15): void {
    this.console.log(message);
    this.session.addLogForTask(rjcode, {
      level: level,
      message: message.substring(truncate),
    } satisfies ScannerLog);
  }
}

export { ScannerLogger };
