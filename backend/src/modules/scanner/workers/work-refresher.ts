import { formatRjCode } from '../../media/rj-code.js';
import { ScanCounters } from '../support/counters.js';
import type { ScanResult } from '../support/counters.js';
import type { ScannerLog, ScanTask } from '../support/session.js';

type WorkRefresherOptions = {
  tasks: ScanTask[];
  addMainLog: (log: ScannerLog) => void;
  emitMainLog: (message: string) => void;
  removeTask: (rjcode: string) => void;
  addResult: (rjcode: string, result: Extract<ScanResult, 'updated' | 'failed'>, count: number) => void;
  consoleLogger?: Pick<Console, 'log'>;
};

type WorkIdRow = Record<string, number>;

const createWorkRefresher = ({
  tasks,
  addMainLog,
  emitMainLog,
  removeTask,
  addResult,
  consoleLogger = console,
}: WorkRefresherOptions) => {
  const markTaskResult = (rjcode: string, result: Extract<ScanResult, 'updated' | 'failed'>): void => {
    const task = tasks.find((task) => task.rjcode === rjcode);
    if (task) task.result = result;
    removeTask(rjcode);
  };

  const refreshWorks = async (
    query: Promise<WorkIdRow[]>,
    idColumnName: string,
    processor: (id: number) => Promise<Extract<ScanResult, 'updated' | 'failed'>>
  ): Promise<ScanCounters> => {
    return query.then(async (works) => {
      consoleLogger.log(` * 共 ${works.length} 个音声.`);
      addMainLog({
        level: 'info',
        message: `共 ${works.length} 个作品. 开始刷新`,
      });

      const counts = new ScanCounters();

      const promises = works.map((work) => {
        const workid = work[idColumnName];
        const rjcode = formatRjCode(workid);
        return processor(workid).then((result) => {
          counts.increment(result === 'failed' ? 'failed' : 'updated');
          markTaskResult(rjcode, result);
          if (result === 'failed') {
            addResult(rjcode, 'failed', counts.failed);
          } else {
            addResult(rjcode, 'updated', counts.updated);
          }
        });
      });

      await Promise.all(promises);
      emitMainLog(` * 完成元数据更新 ${counts.updated} 个，失败 ${counts.failed} 个.`);

      return counts;
    });
  };

  return { refreshWorks };
};

export { createWorkRefresher };
