import path from 'path';
import type { RootFolderConfig } from '../../../config/types.js';
import type { ScannerLog, WorkFolder } from '../../media/folder-scanner.js';
import { formatRjCode } from '../../media/rj-code.js';
import { dedupeFoldersById } from './folder-dedupe.js';

type FolderCollectorOptions = {
  rootFolders: RootFolderConfig[];
  getFolderList: (
    rootFolder: RootFolderConfig,
    current: string,
    depth: number,
    callback: (log: ScannerLog) => void
  ) => AsyncIterable<WorkFolder>;
  addMainLog: (log: ScannerLog) => void;
  consoleLogger?: Pick<Console, 'log'>;
};

const createFolderCollector = ({
  rootFolders,
  getFolderList,
  addMainLog,
  consoleLogger = console,
}: FolderCollectorOptions) => {
  const collectFolders = async (): Promise<WorkFolder[]> => {
    const folderList: WorkFolder[] = [];
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

  const logDuplicateFolders = (uniqueFolderList: WorkFolder[], duplicate: Record<string, WorkFolder[]>): void => {
    Object.keys(duplicate).forEach((key) => {
      const addedFolder = uniqueFolderList.find((folder) => folder.id === parseInt(key));
      if (!addedFolder) return;
      duplicate[key].push(addedFolder);

      const rjcode = formatRjCode(key);
      consoleLogger.log(` -> [RJ${rjcode}] 存在多个文件夹:`);
      addMainLog({
        level: 'info',
        message: `[RJ${rjcode}] 存在多个文件夹:`,
      });

      duplicate[key].forEach((folder) => {
        const rootFolder = rootFolders.find((rootFolder) => rootFolder.name === folder.rootFolderName);
        if (!rootFolder) return;
        const absolutePath = path.join(rootFolder.path, folder.relativePath);
        consoleLogger.log(`   "${absolutePath}"`);
        addMainLog({
          level: 'info',
          message: `"${absolutePath}"`,
        });
      });
    });
  };

  const dedupeAndReport = (folderList: WorkFolder[]): { uniqueFolderList: WorkFolder[]; duplicateNum: number } => {
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

  const collectUniqueFolders = async (): Promise<{ uniqueFolderList: WorkFolder[]; duplicateNum: number }> =>
    dedupeAndReport(await collectFolders());

  return {
    collectFolders,
    collectUniqueFolders,
    dedupeAndReport,
    logDuplicateFolders,
  };
};

export { createFolderCollector };
