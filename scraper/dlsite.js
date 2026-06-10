const cheerio = require('cheerio'); // 解析器

const axios = require('./axios'); // 数据请求
const { nameToUUID, hasLetter } = require('./utils');
const scrapeWorkMetadataFromHVDB = require('./hvdb');
const { formatRjCode } = require('../src/modules/media/rj-code');
const {
  buildDlsiteDynamicMetadataUrl,
  buildDlsiteWorkUrl,
  getDlsiteLanguageConfig,
  parseDynamicWorkMetadata,
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

    const work = { id, tags: [], vas: [] };
    const dlsiteLanguage = getDlsiteLanguageConfig(language);

    axios
      .retryGet(url, {
        retry: {},
        headers: { cookie: dlsiteLanguage.cookieLocale }, // 自定义请求头
      })
      .then(response => response.data)
      .then(data => {
        // 解析
        // 转换成 jQuery 对象
        const $ = cheerio.load(data);

        // 标题
        work.title = $('meta[property="og:title"]').attr('content');
        // fallback
        if (work.title === undefined) {
          work.title = $(`a[href="${url}"] span`).text();
        }

        // 'xxxxx [circle_name] | DLsite' => 'xxxxx'
        const titlePattern = / \[.+\] \| DLsite$/;
        work.title = work.title.replace(titlePattern, '');

        // 社团
        const circleElement = $('span[class="maker_name"]').children('a');
        const circleUrl = circleElement.attr('href');
        const circleName = circleElement.text();
        work.circle = circleUrl && circleName ? { id: parseInt(circleUrl.substr(-10, 5)), name: circleName } : {};

        const workOutline = $('#work_outline');
        // NSFW
        const R18 = workOutline
          .children('tbody')
          .children('tr')
          .children('th')
          .filter(function () {
            return $(this).text() === dlsiteLanguage.ageRatingsLabel;
          })
          .parent()
          .children('td')
          .find('span:first')
          .text();
        work.nsfw = R18 === '18禁';

        // 贩卖日 (YYYY-MM-DD)
        const release = workOutline
          .children('tbody')
          .children('tr')
          .children('th')
          .filter(function () {
            return $(this).text() === dlsiteLanguage.releaseLabel;
          })
          .parent()
          .children('td')
          .text()
          .replace(/[^0-9]/gi, '');
        work.release =
          release.length >= 8 ? `${release.slice(0, 4)}-${release.slice(4, 6)}-${release.slice(6, 8)}` : '';

        // 系列
        const seriesElement = workOutline
          .children('tbody')
          .children('tr')
          .children('th')
          .filter(function () {
            return $(this).text() === dlsiteLanguage.seriesLabel;
          })
          .parent()
          .children('td')
          .children('a');
        if (seriesElement.length) {
          const seriesUrl = seriesElement.attr('href');
          if (seriesUrl.match(/SRI(\d{10})/)) {
            work.series = {
              id: parseInt(seriesUrl.match(/SRI(\d{10})/)[1]),
              name: seriesElement.text(),
            };
          }
        }

        // 标签
        workOutline
          .children('tbody')
          .children('tr')
          .children('th')
          .filter(function () {
            return $(this).text() === dlsiteLanguage.genreLabel;
          })
          .parent()
          .children('td')
          .children('div')
          .children('a')
          .each(function () {
            const tagUrl = $(this).attr('href');
            const tagName = $(this).text();
            if (tagUrl.match(/genre\/(\d{3})/)) {
              work.tags.push({
                id: parseInt(tagUrl.match(/genre\/(\d{3})/)[1]),
                name: tagName,
              });
            }
          });

        // 声优
        workOutline
          .children('tbody')
          .children('tr')
          .children('th')
          .filter(function () {
            return $(this).text() === dlsiteLanguage.voiceActorLabel;
          })
          .parent()
          .children('td')
          .children('a')
          .each(function () {
            const vaName = $(this).text().trim();
            work.vas.push({
              id: nameToUUID(vaName),
              name: vaName,
            });
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
