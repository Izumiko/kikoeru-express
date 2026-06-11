import { formatRjCode } from '../media/rj-code.js';
import { buildHvdbWorkUrl, parseHvdbWorkMetadataHtml } from './hvdb-metadata.js';
import type { HvdbWorkMetadata } from './hvdb-metadata.js';
import type { RetryRequestConfig } from './retry-config.js';

type RetryHttpClient = {
  retryGet: (url: string, config: RetryRequestConfig) => Promise<{ data: unknown }>;
};

type HvdbScraperOptions = {
  httpClient: RetryHttpClient;
  nameToUUID: (name: string) => string;
  consoleLogger?: Pick<Console, 'log'>;
};

type HttpResponseError = {
  response?: {
    status?: number;
  };
  request?: unknown;
  message?: string;
};

const createHvdbScraper = ({ httpClient, nameToUUID, consoleLogger = console }: HvdbScraperOptions) => {
  /**
   * Scrapes work metadata from public HVDB page HTML.
   * @param {number} id Work id.
   */
  const scrapeWorkMetadataFromHVDB = (id: number): Promise<HvdbWorkMetadata> =>
    new Promise((resolve, reject) => {
      const rjcode = formatRjCode(id);
      const url = buildHvdbWorkUrl(id);

      consoleLogger.log(`[RJ${rjcode}] 从 HVDB 抓取元数据...`);
      httpClient
        .retryGet(url, { retry: {} })
        .then((response) => {
          consoleLogger.log('res HVDB');
          return response.data;
        })
        .then((data) => {
          const work = parseHvdbWorkMetadataHtml({ html: String(data), id, nameToUUID });

          if (work.tags.length === 0 && work.vas.length === 0) {
            reject(new Error("Couldn't parse data from HVDB work page."));
          } else {
            consoleLogger.log(`[RJ${rjcode}] 成功从 HVDB 抓取元数据...`);
            resolve(work);
          }
        })
        .catch((error: HttpResponseError) => {
          if (error.response) {
            // 请求已发出，但服务器响应的状态码不在 2xx 范围内
            reject(new Error(`Couldn't request work page HTML (${url}), received: ${error.response.status}.`));
          } else if (error.request) {
            reject(error);
            consoleLogger.log(error.request);
          } else {
            consoleLogger.log('Error', error.message);
            reject(error);
          }
        });
    });

  return {
    scrapeWorkMetadataFromHVDB,
  };
};

export { createHvdbScraper };
