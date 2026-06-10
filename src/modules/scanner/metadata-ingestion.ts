// @ts-nocheck
import { formatRjCode } from '../media/rj-code.js';

const createMetadataIngestion = ({
  scrapeWorkMetadataFromDLsite,
  insertWorkMetadata,
  addLogForTask,
  consoleLogger = console,
}) => {
  const getMetadata = (id, rootFolderName, dir, tagLanguage) => {
    const rjcode = formatRjCode(id);
    consoleLogger.log(` -> [RJ${rjcode}] 从 DLSite 抓取元数据...`);
    addLogForTask(rjcode, {
      level: 'info',
      message: '从 DLSite 抓取元数据...',
    });

    return scrapeWorkMetadataFromDLsite(id, tagLanguage)
      .then(metadata => {
        consoleLogger.log(` -> [RJ${rjcode}] 元数据抓取成功，准备添加到数据库...`);
        addLogForTask(rjcode, {
          level: 'info',
          message: '元数据抓取成功，准备添加到数据库...',
        });

        metadata.rootFolderName = rootFolderName;
        metadata.dir = dir;
        return insertWorkMetadata(metadata)
          .then(() => {
            consoleLogger.log(` -> [RJ${rjcode}] 元数据成功添加到数据库.`);
            addLogForTask(rjcode, {
              level: 'info',
              message: '元数据成功添加到数据库.',
            });

            return 'added';
          })
          .catch(err => {
            consoleLogger.error(`  ! [RJ${rjcode}] 在插入元数据过程中出错: ${err.message}`);
            addLogForTask(rjcode, {
              level: 'error',
              message: `在插入元数据过程中出错: ${err.message}`,
            });

            return 'failed';
          });
      })
      .catch(err => {
        consoleLogger.error(`  ! [RJ${rjcode}] 在抓取元数据过程中出错: ${err.message}`);
        addLogForTask(rjcode, {
          level: 'error',
          message: `在抓取元数据过程中出错: ${err.message}`,
        });

        return 'failed';
      });
  };

  return {
    getMetadata,
  };
};

export {
  createMetadataIngestion,
};
