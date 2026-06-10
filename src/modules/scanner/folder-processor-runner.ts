// @ts-nocheck
import { formatRjCode } from '../media/rj-code.js';

const createFolderProcessorRunner = ({
  tasks,
  addLogForTask,
  removeTask,
  addResult,
  consoleLogger = console,
}) => {
  const markTaskResult = (rjcode, result) => {
    tasks.find(task => task.rjcode === rjcode).result = result;
    removeTask(rjcode);
  };

  const reportAdded = (rjcode, count) => {
    consoleLogger.log(` -> [RJ${rjcode}] 添加成功! Added: ${count}`);
    addLogForTask(rjcode, {
      level: 'info',
      message: `添加成功! Added: ${count}`,
    });
    markTaskResult(rjcode, 'added');
    addResult(rjcode, 'added', count);
  };

  const reportFailed = (rjcode, count) => {
    consoleLogger.error(` -> [RJ${rjcode}] 添加失败! Failed: ${count}`);
    addLogForTask(rjcode, {
      level: 'error',
      message: `添加失败! Failed: ${count}`,
    });
    markTaskResult(rjcode, 'failed');
    addResult(rjcode, 'failed', count);
  };

  const processFolderResult = (folder, result, counts) => {
    const rjcode = formatRjCode(folder.id);
    counts.increment(result);

    if (result === 'added') {
      reportAdded(rjcode, counts.added);
    } else if (result === 'failed') {
      reportFailed(rjcode, counts.failed);
    }
  };

  const processFolders = (folders, processor, counts) =>
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
