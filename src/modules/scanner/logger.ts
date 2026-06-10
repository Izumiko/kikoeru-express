// @ts-nocheck
class ScannerLogger {
  constructor(session, consoleLogger = console) {
    this.session = session;
    this.console = consoleLogger;
  }

  emitMainLog(message, level = 'info', truncate = 3) {
    this.console.log(message);
    this.session.addMainLog({
      level: level,
      message: message.substring(truncate),
    });
  }

  emitTaskLog(message, rjcode, level = 'info', truncate = 15) {
    this.console.log(message);
    this.session.addLogForTask(rjcode, {
      level: level,
      message: message.substring(truncate),
    });
  }
}

export { ScannerLogger };
