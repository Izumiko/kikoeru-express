import { SOCKET_EVENTS } from '../../socket/events.js';
import type { SocketEventName } from '../../socket/events.js';
import type { ScanResult } from './counters.js';

type ScannerLog = {
  level: string;
  message: string;
};

type ScanTask = {
  rjcode: string | number;
  result: ScanResult | null;
  logs: ScannerLog[];
};

type ScanResultRecord = {
  rjcode: string | number;
  result: ScanResult;
  count: number;
};

type ScanSessionSnapshot = {
  tasks: ScanTask[];
  failedTasks: ScanTask[];
  mainLogs: ScannerLog[];
  results: ScanResultRecord[];
};

type ScannerEvent = {
  event: SocketEventName;
  payload: unknown;
};

type ScannerEventSender = (event: ScannerEvent) => void;

class ScanSession {
  send: ScannerEventSender;
  tasks: ScanTask[];
  failedTasks: ScanTask[];
  mainLogs: ScannerLog[];
  results: ScanResultRecord[];

  constructor(send: ScannerEventSender = function noop() {}) {
    this.send = send;
    this.tasks = [];
    this.failedTasks = [];
    this.mainLogs = [];
    this.results = [];
  }

  snapshot(): ScanSessionSnapshot {
    return {
      tasks: this.tasks,
      failedTasks: this.failedTasks,
      mainLogs: this.mainLogs,
      results: this.results,
    };
  }

  emit(event: SocketEventName, payload: unknown): void {
    this.send({ event, payload });
  }

  emitInitState(): void {
    this.emit(SOCKET_EVENTS.SCAN_INIT_STATE, this.snapshot());
  }

  addTask(rjcode: string | number): void {
    this.tasks.push({
      rjcode,
      result: null,
      logs: [],
    });
  }

  removeTask(rjcode: string | number): void {
    const index = this.tasks.findIndex(task => task.rjcode === rjcode);
    const task = this.tasks[index];
    this.tasks.splice(index, 1);
    this.emit(SOCKET_EVENTS.SCAN_TASKS, {
      tasks: this.tasks,
    });

    if (task && task.result === 'failed') {
      this.failedTasks.push(task);
      this.emit(SOCKET_EVENTS.SCAN_FAILED_TASKS, {
        failedTasks: this.failedTasks,
      });
    }
  }

  addLogForTask(rjcode: string | number, log: ScannerLog): void {
    this.tasks.find(task => task.rjcode === rjcode)?.logs.push(log);
    this.emit(SOCKET_EVENTS.SCAN_TASKS, {
      tasks: this.tasks,
    });
  }

  addResult(rjcode: string | number, result: ScanResult, count: number): void {
    this.results.push({
      rjcode,
      result,
      count,
    });
    this.emit(SOCKET_EVENTS.SCAN_RESULTS, {
      results: this.results,
    });
  }

  addMainLog(log: ScannerLog): void {
    this.mainLogs.push(log);
    this.emit(SOCKET_EVENTS.SCAN_MAIN_LOGS, {
      mainLogs: this.mainLogs,
    });
  }
}

export { ScanSession };
export type { ScannerEvent, ScannerEventSender, ScannerLog, ScanResultRecord, ScanSessionSnapshot, ScanTask };
