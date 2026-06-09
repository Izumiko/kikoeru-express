class ScannerLifecycle {
  constructor({ send, destroyDatabase, exit, consoleLogger = console }) {
    this.send = send;
    this.destroyDatabase = destroyDatabase;
    this.exit = exit;
    this.console = consoleLogger;
  }

  finish(message, exitCode = null) {
    this.console.log(` * ${message}`);
    this.send({
      event: 'SCAN_FINISHED',
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

module.exports = { ScannerLifecycle };
