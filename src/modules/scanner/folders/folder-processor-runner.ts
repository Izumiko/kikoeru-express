import type { WorkFolder } from '../../media/folder-scanner.js';
import { formatRjCode } from '../../media/rj-code.js';
import type { ScanCounters, ScanResult } from '../support/counters.js';
import type { ScannerLog, ScanTask } from '../support/session.js';

type FolderProcessResult = Extract<ScanResult, 'added' | 'failed' | 'skipped'>;

type FolderProcessorRunnerOptions = {
  tasks: ScanTask[];
  addLogForTask: (rjcode: string, log: ScannerLog) => void;
  removeTask: (rjcode: string) => void;
  addResult: (rjcode: string, result: Extract<ScanResult, 'added' | 'failed'>, count: number) => void;
  consoleLogger?: Pick<Console, 'log' | 'error'>;
};

const createFolderProcessorRunner = ({
  tasks,
  addLogForTask,
  removeTask,
  addResult,
  consoleLogger = console,
}: FolderProcessorRunnerOptions) => {
  const markTaskResult = (rjcode: string, result: FolderProcessResult): void => {
    const task = tasks.find(task => task.rjcode === rjcode);
    if (task) task.result = result;
    removeTask(rjcode);
  };

  const reportAdded = (rjcode: string, count: number): void => {
    consoleLogger.log(` -> [RJ${rjcode}] 添加成功! Added: ${count}`);
    addLogForTask(rjcode, {
      level: 'info',
      message: `添加成功! Added: ${count}`,
    });
    markTaskResult(rjcode, 'added');
    addResult(rjcode, 'added', count);
  };

  const reportFailed = (rjcode: string, count: number): void => {
    consoleLogger.error(` -> [RJ${rjcode}] 添加失败! Failed: ${count}`);
    addLogForTask(rjcode, {
      level: 'error',
      message: `添加失败! Failed: ${count}`,
    });
    markTaskResult(rjcode, 'failed');
    addResult(rjcode, 'failed', count);
  };

  const processFolderResult = (folder: WorkFolder, result: FolderProcessResult, counts: ScanCounters): void => {
    const rjcode = formatRjCode(folder.id);
    counts.increment(result);

    if (result === 'added') {
      reportAdded(rjcode, counts.added);
    } else if (result === 'failed') {
      reportFailed(rjcode, counts.failed);
    }
  };

  const processFolders = (
    folders: WorkFolder[],
    processor: (folder: WorkFolder) => Promise<FolderProcessResult>,
    counts: ScanCounters
  ): Promise<void[]> =>
    Promise.all(
      folders.map(folder =>
        processor(folder).then(result => {
          processFolderResult(folder, result, counts);
        })
      )
    );

  return {
    processFolderResult,
    processFolders,
  };
};

export { createFolderProcessorRunner };
