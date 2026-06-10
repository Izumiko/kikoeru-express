/* eslint-disable node/no-unpublished-require */
const { expect } = require('chai');
const {
  buildDlsiteDynamicMetadataUrl,
  buildDlsiteWorkUrl,
  getDlsiteLanguageConfig,
  parseDynamicWorkMetadata,
  parseStaticWorkMetadataHtml,
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

  it('parses static metadata from DLsite work HTML', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="测试作品 [测试社团] | DLsite">
        </head>
        <body>
          <span class="maker_name">
            <a href="https://www.dlsite.com/maniax/circle/profile/=/maker_id/RG12345.html">测试社团</a>
          </span>
          <table id="work_outline">
            <tbody>
              <tr><th>年龄指定</th><td><span>18禁</span></td></tr>
              <tr><th>贩卖日</th><td>2024年06月01日</td></tr>
              <tr><th>系列名</th><td><a href="/maniax/fsr/=/keyword/SRI0000012345">测试系列</a></td></tr>
              <tr><th>分类</th><td><div><a href="/genre/123">ASMR</a></div></td></tr>
              <tr><th>声优</th><td><a href="/search/=/keyword/声优A"> 声优A </a></td></tr>
            </tbody>
          </table>
        </body>
      </html>
    `;

    expect(
      parseStaticWorkMetadataHtml({
        html,
        id: 123,
        url: buildDlsiteWorkUrl(123),
        languageConfig: getDlsiteLanguageConfig('zh-cn'),
        nameToUUID: name => `uuid-${name}`,
      })
    ).to.deep.equal({
      id: 123,
      title: '测试作品',
      circle: {
        id: 12345,
        name: '测试社团',
      },
      nsfw: true,
      release: '2024-06-01',
      series: {
        id: 12345,
        name: '测试系列',
      },
      tags: [
        {
          id: 123,
          name: 'ASMR',
        },
      ],
      vas: [
        {
          id: 'uuid-声优A',
          name: '声优A',
        },
      ],
    });
  });

  it('falls back to the product link title when og:title is absent', () => {
    const url = buildDlsiteWorkUrl(123);
    const html = `
      <a href="${url}"><span>备用标题 [社团] | DLsite</span></a>
      <table id="work_outline"><tbody></tbody></table>
    `;

    const metadata = parseStaticWorkMetadataHtml({
      html,
      id: 123,
      url,
      languageConfig: getDlsiteLanguageConfig('zh-cn'),
      nameToUUID: name => name,
    });

    expect(metadata.title).to.equal('备用标题');
  });
});
