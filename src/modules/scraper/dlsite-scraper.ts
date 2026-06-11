import { formatRjCode } from '../media/rj-code.js';
import type { RetryRequestConfig } from './retry-config.js';
import type { HvdbWorkMetadata } from './hvdb-metadata.js';
import {
  buildDlsiteDynamicMetadataUrl,
  buildDlsiteWorkUrl,
  getDlsiteLanguageConfig,
  parseDynamicWorkMetadata,
  parseStaticWorkMetadataHtml,
} from './dlsite-metadata.js';
import type { DynamicWorkMetadata, StaticWorkMetadata, WorkVoiceActor } from './dlsite-metadata.js';

type RetryHttpClient = {
  retryGet: (url: string, config: RetryRequestConfig) => Promise<{ data: unknown }>;
};

type DlsiteScraperOptions = {
  httpClient: RetryHttpClient;
  scrapeWorkMetadataFromHVDB: (id: number) => Promise<HvdbWorkMetadata>;
  nameToUUID: (name: string) => string;
  hasLetter: (value: string) => boolean;
  consoleLogger?: Pick<Console, 'log'>;
};

type FallbackLanguageState = {
  language?: string | null;
  initLanguage?: string;
};

type HttpResponseError = Error & {
  response?: {
    status?: number;
  };
};

const withCause = (message: string, cause: unknown): Error => {
  const error = new Error(message);
  (error as Error & { cause?: unknown }).cause = cause;
  return error;
};

const createDlsiteScraper = ({
  httpClient,
  scrapeWorkMetadataFromHVDB,
  nameToUUID,
  hasLetter,
  consoleLogger = console,
}: DlsiteScraperOptions) => {
  const addHvdbVoiceActors = async (id: number, work: StaticWorkMetadata): Promise<StaticWorkMetadata> => {
    if (work.vas.length !== 0) {
      return work;
    }

    // 从 DLsite 抓不到声优信息时，从 HVDB 抓取声优信息。
    const metadata = await scrapeWorkMetadataFromHVDB(id);
    if (metadata.vas.length <= 1) {
      // HVDB 只有一个声优时可能是 N/A，保留旧行为直接使用。
      work.vas = metadata.vas;
    } else {
      metadata.vas.forEach((va) => {
        // HVDB 有时会同时返回英文别名；旧逻辑会过滤掉英文声优名。
        if (va.name && !hasLetter(va.name)) {
          work.vas.push(va as WorkVoiceActor);
        }
      });
    }

    return work;
  };

  const scrapeStaticWorkMetadataOnce = async (id: number, language: string): Promise<StaticWorkMetadata> => {
    const url = buildDlsiteWorkUrl(id);
    const dlsiteLanguage = getDlsiteLanguageConfig(language);
    const response = await httpClient.retryGet(url, {
      retry: {},
      headers: { cookie: dlsiteLanguage.cookieLocale },
    });
    const work = parseStaticWorkMetadataHtml({
      html: String(response.data),
      id,
      url,
      languageConfig: dlsiteLanguage,
      nameToUUID,
    });

    if (work.tags.length === 0 && work.vas.length === 0) {
      throw new Error("Couldn't parse data from DLsite work page.");
    }

    return addHvdbVoiceActors(id, work);
  };

  const scrapeStaticWorkMetadataFromDLsite = async (
    id: number,
    language: string,
    successLanguage: FallbackLanguageState = {}
  ): Promise<StaticWorkMetadata> => {
    const rjcode = formatRjCode(id);
    const url = buildDlsiteWorkUrl(id);

    try {
      const work = await scrapeStaticWorkMetadataOnce(id, language);
      successLanguage.language = language;
      return work;
    } catch (error: unknown) {
      try {
        // 尝试从其他语言版本获取元数据，保留旧 fallback 顺序：zh-cn -> zh-tw -> ja-jp。
        // TODO: 验证是语言设置生效还是节点位置生效。
        const fallbackState = successLanguage || {
          language: null,
          initLanguage: language,
        };
        if (language === 'zh-cn') {
          const metadata = await scrapeStaticWorkMetadataFromDLsite(id, 'zh-tw', fallbackState);
          if (fallbackState.initLanguage === language) {
            consoleLogger.log(`[RJ${rjcode}] 成功从 DLsite (${fallbackState.language}) 下载原数据`);
          }
          return metadata;
        } else if (language === 'zh-tw') {
          const metadata = await scrapeStaticWorkMetadataFromDLsite(id, 'ja-jp', fallbackState);
          if (fallbackState.initLanguage === language) {
            consoleLogger.log(`[RJ${rjcode}] 成功从 DLsite (${fallbackState.language}) 下载原数据`);
          }
          return metadata;
        }
      } catch {
        // 此处不需要处理错误：其他语言版本失败时，继续抛出第一轮请求的错误。
      }

      const responseError = error as HttpResponseError;
      if (responseError.response) {
        // 请求已发出，但服务器响应的状态码不在 2xx 范围内。
        throw withCause(`Couldn't request work page HTML (${url}), received: ${responseError.response.status}.`, error);
      }
      throw error;
    }
  };

  const scrapeDynamicWorkMetadataFromDLsite = async (id: number): Promise<DynamicWorkMetadata> => {
    const rjcode = formatRjCode(id);
    const url = buildDlsiteDynamicMetadataUrl(id);

    try {
      const response = await httpClient.retryGet(url, { retry: {} });
      const responseData = response.data as Record<string, unknown>;
      const work = parseDynamicWorkMetadata(responseData[`RJ${rjcode}`] as never);
      consoleLogger.log(`[RJ${rjcode}] 成功从 DLSite 抓取Dynamic元数据...`);
      return work;
    } catch (error: unknown) {
      const responseError = error as HttpResponseError;
      if (responseError.response) {
        // 请求已发出，但服务器响应的状态码不在 2xx 范围内。
        throw withCause(`Couldn't request work page HTML (${url}), received: ${responseError.response.status}.`, error);
      }
      throw error;
    }
  };

  const scrapeWorkMetadataFromDLsite = (
    id: number,
    language: string
  ): Promise<StaticWorkMetadata & DynamicWorkMetadata> =>
    Promise.all([scrapeStaticWorkMetadataFromDLsite(id, language), scrapeDynamicWorkMetadataFromDLsite(id)]).then(
      (res) => Object.assign({}, res[0], res[1])
    );

  return {
    addHvdbVoiceActors,
    scrapeDynamicWorkMetadataFromDLsite,
    scrapeStaticWorkMetadataFromDLsite,
    scrapeStaticWorkMetadataOnce,
    scrapeWorkMetadataFromDLsite,
  };
};

export { createDlsiteScraper };
