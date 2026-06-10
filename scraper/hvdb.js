const axios = require('./axios'); // 数据请求
const { nameToUUID } = require('./utils');
const { formatRjCode } = require('../src/modules/media/rj-code');
const { buildHvdbWorkUrl, parseHvdbWorkMetadataHtml } = require('../src/modules/scraper/hvdb-metadata');

/**
 * Scrapes work metadata from public HVDB page HTML.
 * @param {number} id Work id.
 */
const scrapeWorkMetadataFromHVDB = id =>
  new Promise((resolve, reject) => {
    const rjcode = formatRjCode(id);
    const url = buildHvdbWorkUrl(id);

    console.log(`[RJ${rjcode}] 从 HVDB 抓取元数据...`);
    axios
      .retryGet(url, { retry: {} })
      .then(response => {
        console.log('res HVDB');
        return response.data;
      })
      .then(data => {
        const work = parseHvdbWorkMetadataHtml({ html: data, id, nameToUUID });

        if (work.tags.length === 0 && work.vas.length === 0) {
          reject(new Error("Couldn't parse data from HVDB work page."));
        } else {
          console.log(`[RJ${rjcode}] 成功从 HVDB 抓取元数据...`);
          resolve(work);
        }
      })
      .catch(error => {
        if (error.response) {
          // 请求已发出，但服务器响应的状态码不在 2xx 范围内
          reject(new Error(`Couldn't request work page HTML (${url}), received: ${error.response.status}.`));
        } else if (error.request) {
          reject(error);
          console.log(error.request);
        } else {
          console.log('Error', error.message);
          reject(error);
        }
      });
  });

module.exports = scrapeWorkMetadataFromHVDB;
