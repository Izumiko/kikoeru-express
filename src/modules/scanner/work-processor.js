const fs = require('fs');
const path = require('path');
const { formatRjCode } = require('../media/rj-code');

const createWorkProcessor = ({
  workExists,
  coverFolderDir,
  tagLanguage,
  getMetadata,
  getCoverImage,
  addTask,
  addLogForTask,
  consoleLogger = console,
}) => {
  const coverTypes = ['main', 'sam', '240x240'];

  const findMissingCoverTypes = rjcode =>
    coverTypes.filter(type => !fs.existsSync(path.join(coverFolderDir, `RJ${rjcode}_img_${type}.jpg`)));

  const processFolder = folder =>
    workExists(folder.id).then(exists => {
      const rjcode = formatRjCode(folder.id);
      if (exists) {
        // 数据库中已有元数据时，只检查封面是否缺失。
        const lostCoverTypes = findMissingCoverTypes(rjcode);

        if (lostCoverTypes.length) {
          consoleLogger.log(`  ! [RJ${rjcode}] 封面图片缺失，重新下载封面图片...`);
          addTask(rjcode);
          addLogForTask(rjcode, {
            level: 'info',
            message: '封面图片缺失，重新下载封面图片...',
          });

          return getCoverImage(folder.id, lostCoverTypes);
        } else {
          return 'skipped';
        }
      } else {
        consoleLogger.log(` * 发现新文件夹: "${folder.absolutePath}"`);
        addTask(rjcode);
        addLogForTask(rjcode, {
          level: 'info',
          message: `发现新文件夹: "${folder.absolutePath}"`,
        });

        return getMetadata(folder.id, folder.rootFolderName, folder.relativePath, tagLanguage).then(result => {
          if (result === 'failed') {
            // 如果获取元数据失败，跳过封面图片下载。
            return 'failed';
          } else {
            return getCoverImage(folder.id, coverTypes);
          }
        });
      }
    });

  return {
    processFolder,
    findMissingCoverTypes,
  };
};

module.exports = { createWorkProcessor };
