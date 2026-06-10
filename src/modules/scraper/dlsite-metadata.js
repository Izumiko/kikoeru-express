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

module.exports = {
  buildDlsiteDynamicMetadataUrl,
  buildDlsiteWorkUrl,
  getDlsiteLanguageConfig,
  parseDynamicWorkMetadata,
};
