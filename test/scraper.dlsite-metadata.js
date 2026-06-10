/* eslint-disable node/no-unpublished-require */
const { expect } = require('chai');
const {
  buildDlsiteDynamicMetadataUrl,
  buildDlsiteWorkUrl,
  getDlsiteLanguageConfig,
  parseDynamicWorkMetadata,
} = require('../src/modules/scraper/dlsite-metadata');

describe('dlsite metadata helpers', () => {
  it('builds legacy DLsite work and dynamic metadata urls', () => {
    expect(buildDlsiteWorkUrl(123)).to.equal('https://www.dlsite.com/maniax/work/=/product_id/RJ000123.html');
    expect(buildDlsiteDynamicMetadataUrl(123)).to.equal(
      'https://www.dlsite.com/maniax-touch/product/info/ajax?product_id=RJ000123'
    );
  });

  it('returns locale cookies and labels for supported DLsite languages', () => {
    expect(getDlsiteLanguageConfig('ja-jp')).to.include({
      cookieLocale: 'locale=ja-jp',
      ageRatingsLabel: '年齢指定',
      genreLabel: 'ジャンル',
      releaseLabel: '販売日',
      seriesLabel: 'シリーズ名',
      voiceActorLabel: '声優',
    });
    expect(getDlsiteLanguageConfig('zh-tw')).to.include({
      cookieLocale: 'locale=zh-tw',
      ageRatingsLabel: '年齡指定',
      genreLabel: '分類',
      releaseLabel: '販賣日',
      seriesLabel: '系列名',
      voiceActorLabel: '聲優',
    });
  });

  it('defaults unknown language to zh-cn labels', () => {
    expect(getDlsiteLanguageConfig('en-us')).to.include({
      cookieLocale: 'locale=zh-cn',
      ageRatingsLabel: '年龄指定',
      genreLabel: '分类',
      releaseLabel: '贩卖日',
      seriesLabel: '系列名',
      voiceActorLabel: '声优',
    });
  });

  it('parses dynamic metadata while preserving legacy defaults', () => {
    expect(
      parseDynamicWorkMetadata({
        dl_count: '',
        rate_average_2dp: null,
        rate_count: undefined,
        rate_count_detail: { five: 1 },
        review_count: 3,
        price: 1100,
        rank: [],
      })
    ).to.deep.equal({
      dl_count: '0',
      rate_average_2dp: 0,
      rate_count: 0,
      rate_count_detail: { five: 1 },
      review_count: 3,
      price: 1100,
    });
  });

  it('keeps dynamic rank when DLsite returns one', () => {
    expect(
      parseDynamicWorkMetadata({
        dl_count: 12,
        rate_average_2dp: 4.5,
        rate_count: 10,
        rate_count_detail: {},
        review_count: 2,
        price: 770,
        rank: [{ term: 'daily', rank: 1 }],
      })
    ).to.deep.equal({
      dl_count: 12,
      rate_average_2dp: 4.5,
      rate_count: 10,
      rate_count_detail: {},
      review_count: 2,
      price: 770,
      rank: [{ term: 'daily', rank: 1 }],
    });
  });
});
