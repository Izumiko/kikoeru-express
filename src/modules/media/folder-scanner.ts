import fs from 'fs';
import path from 'path';
import { config } from '../../../config.js';
import type { RootFolderConfig } from '../../config/types.js';

export type ScannerLog = {
  level: string;
  message: string;
};

export type WorkFolder = {
  absolutePath: string;
  relativePath: string;
  rootFolderName: string;
  id: number;
};

type LogCallback = (log: ScannerLog) => void;

async function* getFolderList(
  rootFolder: RootFolderConfig,
  current = '',
  depth = 0,
  callback: LogCallback = function addMainLog() {}
): AsyncGenerator<WorkFolder> {
  const folders = await fs.promises.readdir(path.join(rootFolder.path, current));

  for (const folder of folders) {
    const absolutePath = path.resolve(rootFolder.path, current, folder);
    const relativePath = path.join(current, folder);

    try {
      if ((await fs.promises.stat(absolutePath)).isDirectory()) {
        const match = folder.match(/RJ(\d+)/);
        if (match) {
          yield {
            absolutePath,
            relativePath,
            rootFolderName: rootFolder.name,
            id: parseInt(match[1]),
          };
        } else if (depth + 1 < config.scannerMaxRecursionDepth) {
          yield* getFolderList(rootFolder, relativePath, depth + 1, callback);
        }
      }
    } catch (err: unknown) {
      if (isNodeFsError(err) && err.code === 'EPERM') {
        if (err.path && !err.path.endsWith('System Volume Information')) {
          console.log(' ! 无法访问', err.path);
          callback({
            level: 'info',
            message: ` ! 无法访问 ${err.path}`,
          });
        }
      } else {
        throw err;
      }
    }
  }
}

const isNodeFsError = (err: unknown): err is NodeJS.ErrnoException & { path?: string } =>
  err instanceof Error && 'code' in err;

export { getFolderList };
