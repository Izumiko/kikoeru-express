const cheerio = require('cheerio');
const { formatRjCode } = require('../media/rj-code');

const createCoverDownloader = ({ axios, saveCoverImageToDisk, addLogForTask, consoleLogger = console }) => {
  const getImageRequestUrlTemplate = rjcode => {
    return new Promise((resolve, reject) => {
      const url = `https://www.dlsite.com/maniax/work/=/product_id/RJ${rjcode}.html`;
      const COOKIE_LOCALE = 'locale=zh-cn';

      axios
        .retryGet(url, {
          retry: {},
          headers: { cookie: COOKIE_LOCALE },
        })
        .then(response => response.data)
        .then(data => {
          const $ = cheerio.load(data);
          const img = $('div.slider_body ul li:first-child picture img').attr('srcset');
          if (img) {
            const prefix = img.split('_img_')[0];
            resolve(type => {
              if (type === '240x240' || type === '360x360') {
                return `https:${prefix.replace('modpub', 'resize')}_img_main_${type}.jpg`;
              }
              return `https:${prefix}_img_${type}.jpg`;
            });
          }
        })
        .catch(() => {
          reject();
        });
    });
  };

  const saveCoverImage = (imageRes, rjcode, type) =>
    saveCoverImageToDisk(imageRes.data, rjcode, type).then(() => {
      consoleLogger.log(` -> [RJ${rjcode}] 封面 RJ${rjcode}_img_${type}.jpg 下载成功.`);
      addLogForTask(rjcode, {
        level: 'info',
        message: `封面 RJ${rjcode}_img_${type}.jpg 下载成功.`,
      });

      return 'added';
    });

  const getCoverImage = (id, types) => {
    const rjcode = formatRjCode(id);
    const id2 = id % 1000 === 0 ? id : parseInt(id / 1000) * 1000 + 1000;
    const rjcode2 = formatRjCode(id2);
    const promises = [];

    types.forEach(type => {
      let url = `https://img.dlsite.jp/modpub/images2/work/doujin/RJ${rjcode2}/RJ${rjcode}_img_${type}.jpg`;
      if (type === '240x240' || type === '360x360') {
        url = `https://img.dlsite.jp/resize/images2/work/doujin/RJ${rjcode2}/RJ${rjcode}_img_main_${type}.jpg`;
      }
      promises.push(
        axios
          .retryGet(url, { responseType: 'stream', retry: {} })
          .then(imageRes => saveCoverImage(imageRes, rjcode, type))
          .catch(async err => {
            try {
              const imageRequestUrlTemplate = await getImageRequestUrlTemplate(rjcode);

              return axios
                .retryGet(imageRequestUrlTemplate(type), {
                  responseType: 'stream',
                  retry: {},
                })
                .then(imageRes => saveCoverImage(imageRes, rjcode, type))
                .catch(err => {
                  consoleLogger.error(
                    `  ! [RJ${rjcode}] 在下载封面 RJ${rjcode}_img_${type}.jpg 过程中出错: ${err.message}`
                  );
                  addLogForTask(rjcode, {
                    level: 'error',
                    message: `在下载封面 RJ${rjcode}_img_${type}.jpg 过程中出错: ${err.message}`,
                  });

                  return 'failed';
                });
            } catch {
              consoleLogger.error(
                `  ! [RJ${rjcode}] 在下载封面 RJ${rjcode}_img_${type}.jpg 过程中出错: ${err.message}`
              );
              addLogForTask(rjcode, {
                level: 'error',
                message: `在下载封面 RJ${rjcode}_img_${type}.jpg 过程中出错: ${err.message}`,
              });

              return 'failed';
            }
          })
      );
    });

    consoleLogger.log(` -> [RJ${rjcode}] 从 DLsite 下载封面...`);
    addLogForTask(rjcode, {
      level: 'info',
      message: `从 DLsite 下载封面...`,
    });

    return Promise.all(promises).then(results => {
      results.forEach(result => {
        if (result === 'failed') {
          return 'failed';
        }
      });

      return 'added';
    });
  };

  return {
    getCoverImage,
    getImageRequestUrlTemplate,
  };
};

module.exports = { createCoverDownloader };
