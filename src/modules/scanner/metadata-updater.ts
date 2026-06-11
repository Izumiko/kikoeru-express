import { formatRjCode } from '../media/rj-code.js';
import type { ScanResult } from './counters.js';
import type { WorkMetadata } from './metadata-ingestion.js';

type MetadataUpdateOptions = {
  includeVA?: boolean;
  includeTags?: boolean;
  includeNSFW?: boolean;
  refreshAll?: boolean;
  [key: string]: unknown;
};

type MetadataUpdaterOptions = {
  tagLanguage: string;
  scrapeWorkMetadataFromDLsite: (id: number, tagLanguage: string) => Promise<WorkMetadata>;
  scrapeDynamicWorkMetadataFromDLsite: (id: number) => Promise<WorkMetadata>;
  updateWorkMetadata: (metadata: WorkMetadata & { id?: number }, options: MetadataUpdateOptions) => Promise<unknown>;
  addTask: (rjcode: string) => void;
  emitTaskLog: (message: string, rjcode: string, level?: string) => void;
};

const shouldScrapeStaticMetadata = (options: MetadataUpdateOptions): boolean =>
  Boolean(options.includeVA || options.includeTags || options.includeNSFW || options.refreshAll);

const createMetadataUpdater = ({
  tagLanguage,
  scrapeWorkMetadataFromDLsite,
  scrapeDynamicWorkMetadataFromDLsite,
  updateWorkMetadata,
  addTask,
  emitTaskLog,
}: MetadataUpdaterOptions) => {
  const updateMetadata = (
    id: number,
    options: MetadataUpdateOptions | null = {}
  ): Promise<Extract<ScanResult, 'updated' | 'failed'>> => {
    const normalizedOptions = options || {};
    const scrapeProcessor = shouldScrapeStaticMetadata(normalizedOptions)
      ? () => scrapeWorkMetadataFromDLsite(id, tagLanguage)
      : () => scrapeDynamicWorkMetadataFromDLsite(id);

    const rjcode = formatRjCode(id);
    addTask(rjcode);

    return scrapeProcessor()
      .then(metadata => {
        emitTaskLog(` -> [RJ${rjcode}] 元数据抓取成功，准备更新元数据...`, rjcode);
        metadata.id = id;
        return updateWorkMetadata(metadata, normalizedOptions).then(() => {
          emitTaskLog(` -> [RJ${rjcode}] 元数据更新成功`, rjcode);
          return 'updated' as const;
        });
      })
      .catch(err => {
        emitTaskLog(`  ! [RJ${rjcode}] 在抓取元数据过程中出错: ${err}`, rjcode, 'error');
        return 'failed' as const;
      });
  };

  return { updateMetadata };
};

export {
  createMetadataUpdater,
  shouldScrapeStaticMetadata,
};
export type { MetadataUpdateOptions };
