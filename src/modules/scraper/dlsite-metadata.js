const cheerio = require('cheerio');
const { formatRjCode } = require('../media/rj-code');

const DLSITE_LANGUAGE_CONFIG = {
  'ja-jp': {
    cookieLocale: 'locale=ja-jp',
    ageRatingsLabel: '年齢指定',
    genreLabel: 'ジャンル',
    releaseLabel: '販売日',
    seriesLabel: 'シリーズ名',
    voiceActorLabel: '声優',
  },
  'zh-tw': {
    cookieLocale: 'locale=zh-tw',
    ageRatingsLabel: '年齡指定',
    genreLabel: '分類',
    releaseLabel: '販賣日',
    seriesLabel: '系列名',
    voiceActorLabel: '聲優',
  },
  'zh-cn': {
    cookieLocale: 'locale=zh-cn',
    ageRatingsLabel: '年龄指定',
    genreLabel: '分类',
    releaseLabel: '贩卖日',
    seriesLabel: '系列名',
    voiceActorLabel: '声优',
  },
};

const getDlsiteLanguageConfig = language => DLSITE_LANGUAGE_CONFIG[language] || DLSITE_LANGUAGE_CONFIG['zh-cn'];

const buildDlsiteWorkUrl = id => {
  const rjcode = formatRjCode(id);
  return `https://www.dlsite.com/maniax/work/=/product_id/RJ${rjcode}.html`;
};

const buildDlsiteDynamicMetadataUrl = id => {
  const rjcode = formatRjCode(id);
  return `https://www.dlsite.com/maniax-touch/product/info/ajax?product_id=RJ${rjcode}`;
};

const parseDynamicWorkMetadata = data => {
  const work = {};
  work.dl_count = data.dl_count ? data.dl_count : '0';
  work.rate_average_2dp = data.rate_average_2dp ? data.rate_average_2dp : 0.0;
  work.rate_count = data.rate_count ? data.rate_count : 0;
  work.rate_count_detail = data.rate_count_detail;
  work.review_count = data.review_count;
  work.price = data.price;
  if (data.rank.length) {
    work.rank = data.rank;
  }
  return work;
};

const parseStaticWorkMetadataHtml = ({ html, id, url, languageConfig, nameToUUID }) => {
  const $ = cheerio.load(html);
  const work = { id, tags: [], vas: [] };

  work.title = $('meta[property="og:title"]').attr('content');
  if (work.title === undefined) {
    work.title = $(`a[href="${url}"] span`).text();
  }

  const titlePattern = / \[.+\] \| DLsite$/;
  work.title = work.title.replace(titlePattern, '');

  const circleElement = $('span[class="maker_name"]').children('a');
  const circleUrl = circleElement.attr('href');
  const circleName = circleElement.text();
  work.circle = circleUrl && circleName ? { id: parseInt(circleUrl.substr(-10, 5)), name: circleName } : {};

  const workOutline = $('#work_outline');
  const r18 = workOutline
    .children('tbody')
    .children('tr')
    .children('th')
    .filter(function () {
      return $(this).text() === languageConfig.ageRatingsLabel;
    })
    .parent()
    .children('td')
    .find('span:first')
    .text();
  work.nsfw = r18 === '18禁';

  const release = workOutline
    .children('tbody')
    .children('tr')
    .children('th')
    .filter(function () {
      return $(this).text() === languageConfig.releaseLabel;
    })
    .parent()
    .children('td')
    .text()
    .replace(/[^0-9]/gi, '');
  work.release = release.length >= 8 ? `${release.slice(0, 4)}-${release.slice(4, 6)}-${release.slice(6, 8)}` : '';

  const seriesElement = workOutline
    .children('tbody')
    .children('tr')
    .children('th')
    .filter(function () {
      return $(this).text() === languageConfig.seriesLabel;
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

  workOutline
    .children('tbody')
    .children('tr')
    .children('th')
    .filter(function () {
      return $(this).text() === languageConfig.genreLabel;
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

  workOutline
    .children('tbody')
    .children('tr')
    .children('th')
    .filter(function () {
      return $(this).text() === languageConfig.voiceActorLabel;
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

  return work;
};

module.exports = {
  buildDlsiteDynamicMetadataUrl,
  buildDlsiteWorkUrl,
  getDlsiteLanguageConfig,
  parseDynamicWorkMetadata,
  parseStaticWorkMetadataHtml,
};
