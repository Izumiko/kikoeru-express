import fs from 'fs/promises';
import path from 'path';
import { config } from '../../../../config.js';
import type { ScannerLog } from '../../media/folder-scanner.js';
import { formatRjCode } from '../../media/rj-code.js';
import type { ScanResult } from '../support/counters.js';

type WorkMetadata = Record<string, unknown> & {
  rootFolderName?: string;
  dir?: string;
  tags?: Array<{ id: number | string; name: string }>;
};

const hasLrcSubtitle = async (rootFolderName: string, dir: string): Promise<boolean> => {
  const rootFolder = config.rootFolders.find((rf) => rf.name === rootFolderName);
  if (!rootFolder) return false;

  const absolutePath = path.join(rootFolder.path, dir);
  try {
    const files = await fs.readdir(absolutePath, { recursive: true });
    return files.some((file) => path.extname(file).toLowerCase() === '.lrc');
  } catch {
    return false;
  }
};

type MetadataIngestionOptions = {
  scrapeWorkMetadataFromDLsite: (id: number, tagLanguage: string) => Promise<WorkMetadata>;
  insertWorkMetadata: (metadata: WorkMetadata) => Promise<unknown>;
  addLogForTask: (rjcode: string, log: ScannerLog) => void;
  consoleLogger?: Pick<Console, 'log' | 'error'>;
};

const toErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const createMetadataIngestion = ({
  scrapeWorkMetadataFromDLsite,
  insertWorkMetadata,
  addLogForTask,
  consoleLogger = console,
}: MetadataIngestionOptions) => {
  const getMetadata = (
    id: number,
    rootFolderName: string,
    dir: string,
    tagLanguage: string
  ): Promise<Extract<ScanResult, 'added' | 'failed'>> => {
    const rjcode = formatRjCode(id);
    consoleLogger.log(` -> [RJ${rjcode}] 从 DLSite 抓取元数据...`);
    addLogForTask(rjcode, {
      level: 'info',
      message: '从 DLSite 抓取元数据...',
    });

    return scrapeWorkMetadataFromDLsite(id, tagLanguage)
      .then(async (metadata) => {
        consoleLogger.log(` -> [RJ${rjcode}] 元数据抓取成功，准备添加到数据库...`);
        addLogForTask(rjcode, {
          level: 'info',
          message: '元数据抓取成功，准备添加到数据库...',
        });

        metadata.rootFolderName = rootFolderName;
        metadata.dir = dir;

        const hasSubtitle = await hasLrcSubtitle(rootFolderName, dir);
        if (hasSubtitle) {
          metadata.tags = metadata.tags || [];
          if (Array.isArray(metadata.tags)) {
            metadata.tags.push({ id: -1, name: '中文字幕' });
          }
        }

        return insertWorkMetadata(metadata)
          .then(() => {
            consoleLogger.log(` -> [RJ${rjcode}] 元数据成功添加到数据库.`);
            addLogForTask(rjcode, {
              level: 'info',
              message: '元数据成功添加到数据库.',
            });

            return 'added' as const;
          })
          .catch((err: unknown) => {
            const message = toErrorMessage(err);
            consoleLogger.error(`  ! [RJ${rjcode}] 在插入元数据过程中出错: ${message}`);
            addLogForTask(rjcode, {
              level: 'error',
              message: `在插入元数据过程中出错: ${message}`,
            });

            return 'failed' as const;
          });
      })
      .catch((err: unknown) => {
        const message = toErrorMessage(err);
        consoleLogger.error(`  ! [RJ${rjcode}] 在抓取元数据过程中出错: ${message}`);
        addLogForTask(rjcode, {
          level: 'error',
          message: `在抓取元数据过程中出错: ${message}`,
        });

        return 'failed' as const;
      });
  };

  return {
    getMetadata,
  };
};

export { createMetadataIngestion };
export type { WorkMetadata };
