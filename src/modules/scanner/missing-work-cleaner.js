const fs = require('fs');
const path = require('path');
const { formatRjCode } = require('../media/rj-code');

const createMissingWorkCleaner = ({
  knex,
  rootFolders,
  removeWork,
  deleteCoverImageFromDisk,
  addMainLog,
  fileSystem = fs,
  consoleLogger = console,
}) => {
  const findRootFolder = work => rootFolders.find(rootFolder => rootFolder.name === work.root_folder);

  const isWorkFolderPresent = work => {
    const rootFolder = findRootFolder(work);
    return Boolean(rootFolder && fileSystem.existsSync(path.join(rootFolder.path, work.dir)));
  };

  const logCoverDeleteError = (rjcode, err) => {
    consoleLogger.error(`  ! [RJ${rjcode}] 在删除封面过程中出错: ${err.message}`);
    addMainLog({
      level: 'error',
      message: `[RJ${rjcode}] 在删除封面过程中出错: ${err.message}`,
    });
  };

  const removeMissingWork = (work, trxProvider) =>
    removeWork(work.id, trxProvider).then(result => {
      const rjcode = formatRjCode(work.id);
      return deleteCoverImageFromDisk(rjcode)
        .catch(err => {
          if (err && err.code !== 'ENOENT') {
            logCoverDeleteError(rjcode, err);
          }
        })
        .then(() => result);
    });

  const cleanupWorks = (works, trxProvider) =>
    Promise.all(works.map(work => (isWorkFolderPresent(work) ? Promise.resolve() : removeMissingWork(work, trxProvider))));

  const performCleanup = async () => {
    const trxProvider = knex.transactionProvider();
    const trx = await trxProvider();
    const works = await trx('t_work').select('id', 'root_folder', 'dir');
    await cleanupWorks(works, trxProvider);
    await trx.commit();
  };

  return {
    cleanupWorks,
    isWorkFolderPresent,
    performCleanup,
  };
};

module.exports = { createMissingWorkCleaner };
