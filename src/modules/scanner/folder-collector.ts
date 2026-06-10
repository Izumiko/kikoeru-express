// @ts-nocheck
import path from 'path';
import { formatRjCode } from '../media/rj-code.js';
import { dedupeFoldersById } from './folder-dedupe.js';

const createFolderCollector = ({
  rootFolders,
  getFolderList,
  addMainLog,
  consoleLogger = console,
}) => {
  const collectFolders = async () => {
    const folderList = [];
    for (const rootFolder of rootFolders) {
      for await (const folder of getFolderList(rootFolder, '', 0, addMainLog)) {
        folderList.push(folder);
      }
    }

    consoleLogger.log(` * 共找到 ${folderList.length} 个音声文件夹.`);
    addMainLog({
      level: 'info',
      message: `共找到 ${folderList.length} 个音声文件夹.`,
    });

    return folderList;
  };

  const logDuplicateFolders = (uniqueFolderList, duplicate) => {
    Object.keys(duplicate).forEach(key => {
      const addedFolder = uniqueFolderList.find(folder => folder.id === parseInt(key));
      duplicate[key].push(addedFolder);

      const rjcode = formatRjCode(key);
      consoleLogger.log(` -> [RJ${rjcode}] 存在多个文件夹:`);
      addMainLog({
        level: 'info',
        message: `[RJ${rjcode}] 存在多个文件夹:`,
      });

      duplicate[key].forEach(folder => {
        const rootFolder = rootFolders.find(rootFolder => rootFolder.name === folder.rootFolderName);
        const absolutePath = path.join(rootFolder.path, folder.relativePath);
        consoleLogger.log(`   "${absolutePath}"`);
        addMainLog({
          level: 'info',
          message: `"${absolutePath}"`,
        });
      });
    });
  };

  const dedupeAndReport = folderList => {
    const dedupedFolders = dedupeFoldersById(folderList);
    const uniqueFolderList = dedupedFolders.uniqueArr;
    const duplicate = dedupedFolders.duplicate;
    const duplicateNum = folderList.length - uniqueFolderList.length;

    if (duplicateNum) {
      consoleLogger.log(` ! 发现 ${duplicateNum} 个重复的音声文件夹.`);
      addMainLog({
        level: 'info',
        message: `发现 ${duplicateNum} 个重复的音声文件夹.`,
      });
      logDuplicateFolders(uniqueFolderList, duplicate);
    }

    return { uniqueFolderList, duplicateNum };
  };

  const collectUniqueFolders = async () => dedupeAndReport(await collectFolders());

  return {
    collectFolders,
    collectUniqueFolders,
    dedupeAndReport,
    logDuplicateFolders,
  };
};

export { createFolderCollector };
