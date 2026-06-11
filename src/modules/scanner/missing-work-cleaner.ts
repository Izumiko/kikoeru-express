import fs from 'fs';
import path from 'path';
import type { RootFolderConfig } from '../../config/types.js';
import type { ScannerLog } from '../media/folder-scanner.js';
import { formatRjCode } from '../media/rj-code.js';

type WorkStorageLocation = {
  id: number;
  root_folder: string;
  dir: string;
};

type MissingWorkCleanerOptions = {
  listWorkStorageLocations: () => Promise<WorkStorageLocation[]>;
  rootFolders: RootFolderConfig[];
  removeWork: (id: number) => Promise<unknown>;
  deleteCoverImageFromDisk: (rjcode: string) => Promise<void>;
  addMainLog: (log: ScannerLog) => void;
  fileSystem?: Pick<typeof fs, 'existsSync'>;
  consoleLogger?: Pick<Console, 'error'>;
};

const isNodeFsError = (err: unknown): err is NodeJS.ErrnoException =>
  err instanceof Error && 'code' in err;

const createMissingWorkCleaner = ({
  listWorkStorageLocations,
  rootFolders,
  removeWork,
  deleteCoverImageFromDisk,
  addMainLog,
  fileSystem = fs,
  consoleLogger = console,
}: MissingWorkCleanerOptions) => {
  const findRootFolder = (work: WorkStorageLocation): RootFolderConfig | undefined =>
    rootFolders.find(rootFolder => rootFolder.name === work.root_folder);

  const isWorkFolderPresent = (work: WorkStorageLocation): boolean => {
    const rootFolder = findRootFolder(work);
    return Boolean(rootFolder && fileSystem.existsSync(path.join(rootFolder.path, work.dir)));
  };

  const logCoverDeleteError = (rjcode: string, err: Error): void => {
    consoleLogger.error(`  ! [RJ${rjcode}] 在删除封面过程中出错: ${err.message}`);
    addMainLog({
      level: 'error',
      message: `[RJ${rjcode}] 在删除封面过程中出错: ${err.message}`,
    });
  };

  const removeMissingWork = (work: WorkStorageLocation): Promise<unknown> =>
    removeWork(work.id).then(result => {
      const rjcode = formatRjCode(work.id);
      return deleteCoverImageFromDisk(rjcode)
        .catch((err: unknown) => {
          if (isNodeFsError(err) && err.code !== 'ENOENT') {
            logCoverDeleteError(rjcode, err);
          } else if (!isNodeFsError(err)) {
            logCoverDeleteError(rjcode, err instanceof Error ? err : new Error(String(err)));
          }
        })
        .then(() => result);
    });

  const cleanupWorks = (works: WorkStorageLocation[]): Promise<unknown[]> =>
    Promise.all(works.map(work => (isWorkFolderPresent(work) ? Promise.resolve() : removeMissingWork(work))));

  const performCleanup = async (): Promise<void> => {
    const works = await listWorkStorageLocations();
    await cleanupWorks(works);
  };

  return {
    cleanupWorks,
    isWorkFolderPresent,
    performCleanup,
  };
};

export { createMissingWorkCleaner };
