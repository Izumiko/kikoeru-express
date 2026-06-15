import * as cheerio from 'cheerio';
import type { RetryRequestConfig } from '../../scraper/retry-config.js';
import type { ScannerLog } from '../../media/folder-scanner.js';
import { formatRjCode } from '../../media/rj-code.js';

type CoverDownloadResult = 'added' | 'failed';

type CoverResponse = {
  data: unknown;
};

type RetryHttpClient = {
  retryGet: (url: string, options: RetryRequestConfig) => Promise<CoverResponse>;
};

type ImageRequestUrlTemplate = (type: string) => string;

type CoverDownloaderOptions = {
  axios: RetryHttpClient;
  saveCoverImageToDisk: (stream: unknown, rjcode: string, type: string) => Promise<void>;
  addLogForTask: (rjcode: string, log: ScannerLog) => void;
  consoleLogger?: Pick<Console, 'log' | 'error'>;
};

const getErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const createCoverDownloader = ({
  axios,
  saveCoverImageToDisk,
  addLogForTask,
  consoleLogger = console,
}: CoverDownloaderOptions) => {
  const getImageRequestUrlTemplate = (rjcode: string): Promise<ImageRequestUrlTemplate> => {
    return new Promise((resolve, reject) => {
      const url = `https://www.dlsite.com/maniax/work/=/product_id/RJ${rjcode}.html`;
      const COOKIE_LOCALE = 'locale=zh-cn';

      axios
        .retryGet(url, {
          retry: {},
          headers: { cookie: COOKIE_LOCALE },
        })
        .then((response) => response.data)
        .then((data) => {
          const $ = cheerio.load(String(data));
          // 展示图的第一个；之后仅需修改 type 部分即可拼出其他封面尺寸。
          const img = $('div.slider_body ul li:first-child picture img').attr('srcset');
          if (img) {
            // _img_ 前的部分。
            const prefix = img.split('_img_')[0];
            resolve((type) => {
              if (type === '240x240' || type === '360x360') {
                return `https:${prefix.replace('modpub', 'resize')}_img_main_${type}.jpg`;
              }
              return `https:${prefix}_img_${type}.jpg`;
            });
          }
          reject(new Error('Could not parse cover image url template.'));
        })
        .catch(() => {
          reject(new Error('Could not request cover image url template.'));
        });
    });
  };

  const saveCoverImage = (
    imageRes: CoverResponse,
    rjcode: string,
    type: string
  ): Promise<Extract<CoverDownloadResult, 'added'>> =>
    saveCoverImageToDisk(imageRes.data, rjcode, type).then(() => {
      consoleLogger.log(` -> [RJ${rjcode}] 封面 RJ${rjcode}_img_${type}.jpg 下载成功.`);
      addLogForTask(rjcode, {
        level: 'info',
        message: `封面 RJ${rjcode}_img_${type}.jpg 下载成功.`,
      });

      return 'added' as const;
    });

  const getCoverImage = (id: number, types: string[]): Promise<Extract<CoverDownloadResult, 'added'>> => {
    const rjcode = formatRjCode(id);
    const id2 = id % 1000 === 0 ? id : Math.trunc(id / 1000) * 1000 + 1000;
    const rjcode2 = formatRjCode(id2);
    const promises: Array<Promise<CoverDownloadResult>> = [];

    types.forEach((type) => {
      // 对于不是合集的音声，封面图片的请求地址通常由 RJ 分组目录和作品 RJ 号拼出。
      let url = `https://img.dlsite.jp/modpub/images2/work/doujin/RJ${rjcode2}/RJ${rjcode}_img_${type}.jpg`;
      if (type === '240x240' || type === '360x360') {
        url = `https://img.dlsite.jp/resize/images2/work/doujin/RJ${rjcode2}/RJ${rjcode}_img_main_${type}.jpg`;
      }
      promises.push(
        axios
          .retryGet(url, { responseType: 'stream', retry: {} })
          .then((imageRes) => saveCoverImage(imageRes, rjcode, type))
          .catch(async (err: unknown) => {
            try {
              // 可能是网站转发导致图片 RJ code 和音声 RJ code 不同；失败后回到作品首页解析真实头图地址。
              const imageRequestUrlTemplate = await getImageRequestUrlTemplate(rjcode);

              return axios
                .retryGet(imageRequestUrlTemplate(type), {
                  responseType: 'stream',
                  retry: {},
                })
                .then((imageRes) => saveCoverImage(imageRes, rjcode, type))
                .catch((err: unknown) => {
                  const message = getErrorMessage(err);
                  consoleLogger.error(
                    `  ! [RJ${rjcode}] 在下载封面 RJ${rjcode}_img_${type}.jpg 过程中出错: ${message}`
                  );
                  addLogForTask(rjcode, {
                    level: 'error',
                    message: `在下载封面 RJ${rjcode}_img_${type}.jpg 过程中出错: ${message}`,
                  });

                  return 'failed' as const;
                });
            } catch {
              const message = getErrorMessage(err);
              consoleLogger.error(`  ! [RJ${rjcode}] 在下载封面 RJ${rjcode}_img_${type}.jpg 过程中出错: ${message}`);
              addLogForTask(rjcode, {
                level: 'error',
                message: `在下载封面 RJ${rjcode}_img_${type}.jpg 过程中出错: ${message}`,
              });

              return 'failed' as const;
            }
          })
      );
    });

    consoleLogger.log(` -> [RJ${rjcode}] 从 DLsite 下载封面...`);
    addLogForTask(rjcode, {
      level: 'info',
      message: `从 DLsite 下载封面...`,
    });

    return Promise.all(promises).then((results) => {
      results.forEach((result) => {
        if (result === 'failed') {
          return 'failed';
        }
      });

      return 'added' as const;
    });
  };

  return {
    getCoverImage,
    getImageRequestUrlTemplate,
  };
};

export { createCoverDownloader };
