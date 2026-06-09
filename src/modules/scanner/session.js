class ScanSession {
  constructor(send = function noop() {}) {
    this.send = send;
    this.tasks = [];
    this.failedTasks = [];
    this.mainLogs = [];
    this.results = [];
  }

  snapshot() {
    return {
      tasks: this.tasks,
      failedTasks: this.failedTasks,
      mainLogs: this.mainLogs,
      results: this.results,
    };
  }

  emit(event, payload) {
    this.send({ event, payload });
  }

  emitInitState() {
    this.emit('SCAN_INIT_STATE', this.snapshot());
  }

  addTask(rjcode) {
    this.tasks.push({
      rjcode,
      result: null,
      logs: [],
    });
  }

  removeTask(rjcode) {
    const index = this.tasks.findIndex(task => task.rjcode === rjcode);
    const task = this.tasks[index];
    this.tasks.splice(index, 1);
    this.emit('SCAN_TASKS', {
      tasks: this.tasks,
    });

    if (task && task.result === 'failed') {
      this.failedTasks.push(task);
      this.emit('SCAN_FAILED_TASKS', {
        failedTasks: this.failedTasks,
      });
    }
  }

  addLogForTask(rjcode, log) {
    this.tasks.find(task => task.rjcode === rjcode).logs.push(log);
    this.emit('SCAN_TASKS', {
      tasks: this.tasks,
    });
  }

  addResult(rjcode, result, count) {
    this.results.push({
      rjcode,
      result,
      count,
    });
    this.emit('SCAN_RESULTS', {
      results: this.results,
    });
  }

  addMainLog(log) {
    this.mainLogs.push(log);
    this.emit('SCAN_MAIN_LOGS', {
      mainLogs: this.mainLogs,
    });
  }
}

module.exports = { ScanSession };
