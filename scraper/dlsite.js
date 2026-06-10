const axios = require('./axios'); // 数据请求
const { nameToUUID, hasLetter } = require('./utils');
const scrapeWorkMetadataFromHVDB = require('./hvdb');
const { formatRjCode } = require('../src/modules/media/rj-code');
const {
  buildDlsiteDynamicMetadataUrl,
  buildDlsiteWorkUrl,
  getDlsiteLanguageConfig,
  parseDynamicWorkMetadata,
  parseStaticWorkMetadataHtml,
} = require('../src/modules/scraper/dlsite-metadata');

/**
 * Scrapes static work metadata from public DLsite page HTML.
 * @param {number} id Work id.
 * @param {String} language 标签语言，'ja-jp', 'zh-tw' or 'zh-cn'，默认'zh-cn'
 * @param {Object} successLanguage 记录最终成功获取的元数据的语言
 */
const scrapeStaticWorkMetadataFromDLsite = (id, language, successLanguage = {}) =>
  new Promise((resolve, reject) => {
    const rjcode = formatRjCode(id);
    const url = buildDlsiteWorkUrl(id);

    let work;
    const dlsiteLanguage = getDlsiteLanguageConfig(language);

    axios
      .retryGet(url, {
        retry: {},
        headers: { cookie: dlsiteLanguage.cookieLocale }, // 自定义请求头
      })
      .then(response => response.data)
      .then(data => {
        work = parseStaticWorkMetadataHtml({
          html: data,
          id,
          url,
          languageConfig: dlsiteLanguage,
          nameToUUID,
        });

        if (work.tags.length === 0 && work.vas.length === 0) {
          reject(new Error("Couldn't parse data from DLsite work page."));
        }
      })
      .then(() => {
        if (work.vas.length === 0) {
          // 从 DLsite 抓不到声优信息时, 从 HVDB 抓取声优信息
          scrapeWorkMetadataFromHVDB(id)
            .then(metadata => {
              if (metadata.vas.length <= 1) {
                // N/A
                work.vas = metadata.vas;
              } else {
                // 过滤掉英文的声优名
                metadata.vas.forEach(function (va) {
                  if (!hasLetter(va.name)) {
                    work.vas.push(va);
                  }
                });
              }

              successLanguage.language = language;
              resolve(work);
            })
            .catch(error => {
              reject(new Error(error.message));
            });
        } else {
          successLanguage.language = language;
          resolve(work);
        }
      })
      .catch(async error => {
        try {
          // 记录最终成功获取的元数据的语言
          const _successLanguage = successLanguage || {
            language: null,
            initLanguage: language,
          };
          // 尝试从其他语言版本获取元数据
          // TODO: 验证是语言设置生效还是节点位置生效
          if (language === 'zh-cn') {
            const metadata = await scrapeStaticWorkMetadataFromDLsite(id, 'zh-tw', _successLanguage);
            if (_successLanguage.initLanguage === language) {
              console.log(`[RJ${rjcode}] 成功从 DLsite (${_successLanguage.language}) 下载原数据`);
            }
            resolve(metadata);
            return;
          } else if (language === 'zh-tw') {
            const metadata = await scrapeStaticWorkMetadataFromDLsite(id, 'ja-jp', _successLanguage);
            if (_successLanguage.initLanguage === language) {
              console.log(`[RJ${rjcode}] 成功从 DLsite (${_successLanguage.language}) 下载原数据`);
            }
            resolve(metadata);
            return;
          }
        } catch {
          // 此处不需要处理错误
          // 因为是尝试从其他语言版本获取元数据, 如果错误, 可以认为是和第一个尝试的语言相同的错误
          // 当第一层没有成功从其他语言获取到元数据时, 继续执行, 抛出下方的错误
        }

        if (error.response) {
          // 请求已发出，但服务器响应的状态码不在 2xx 范围内
          reject(new Error(`Couldn't request work page HTML (${url}), received: ${error.response.status}.`));
        } else {
          reject(error);
        }
      });
  });

/**
 * Requests dynamic work metadata from public DLsite API.
 * @param {number} id Work id.
 */
const scrapeDynamicWorkMetadataFromDLsite = id =>
  new Promise((resolve, reject) => {
    const rjcode = formatRjCode(id);
    const url = buildDlsiteDynamicMetadataUrl(id);

    axios
      .retryGet(url, { retry: {} })
      .then(response => response.data[`RJ${rjcode}`])
      .then(data => {
        const work = parseDynamicWorkMetadata(data);
        console.log(`[RJ${rjcode}] 成功从 DLSite 抓取Dynamic元数据...`);
        resolve(work);
      })
      .catch(error => {
        if (error.response) {
          // 请求已发出，但服务器响应的状态码不在 2xx 范围内
          reject(new Error(`Couldn't request work page HTML (${url}), received: ${error.response.status}.`));
        } else {
          reject(error);
        }
      });
  });

/**
 * Scrapes work metadata from public DLsite page HTML.
 * @param {number} id Work id.
 * @param {String} language 标签语言，'ja-jp', 'zh-tw' or 'zh-cn'，默认'zh-cn'
 */
const scrapeWorkMetadataFromDLsite = (id, language) => {
  return Promise.all([scrapeStaticWorkMetadataFromDLsite(id, language), scrapeDynamicWorkMetadataFromDLsite(id)]).then(
    res => {
      const work = {};
      return Object.assign(work, res[0], res[1]);
    }
  );
};

module.exports = {
  scrapeWorkMetadataFromDLsite,
  scrapeDynamicWorkMetadataFromDLsite,
};
