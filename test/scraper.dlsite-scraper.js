const { expect } = require('chai');
const { createDlsiteScraper } = require('../src/modules/scraper/dlsite-scraper');

const createStaticHtml = ({ language = 'zh-cn', tags = true, vas = true, title = '标题' } = {}) => {
  const labels = {
    'zh-cn': {
      age: '年龄指定',
      release: '贩卖日',
      series: '系列名',
      genre: '分类',
      va: '声优',
    },
    'zh-tw': {
      age: '年齡指定',
      release: '販賣日',
      series: '系列名',
      genre: '分類',
      va: '聲優',
    },
    'ja-jp': {
      age: '年齢指定',
      release: '販売日',
      series: 'シリーズ名',
      genre: 'ジャンル',
      va: '声優',
    },
  }[language];

  return `
    <meta property="og:title" content="${title} [社团] | DLsite">
    <span class="maker_name"><a href="/maker_id/RG12345.html">社团</a></span>
    <table id="work_outline"><tbody>
      <tr><th>${labels.age}</th><td><span>18禁</span></td></tr>
      <tr><th>${labels.release}</th><td>2024年06月01日</td></tr>
      <tr><th>${labels.series}</th><td><a href="/SRI0000012345">系列</a></td></tr>
      <tr><th>${labels.genre}</th><td><div>${tags ? '<a href="/genre/123">标签</a>' : ''}</div></td></tr>
      <tr><th>${labels.va}</th><td>${vas ? '<a href="/va">声优A</a>' : ''}</td></tr>
    </tbody></table>
  `;
};

describe('createDlsiteScraper', () => {
  let calls;

  beforeEach(() => {
    calls = {
      requests: [],
      hvdb: [],
      logs: [],
    };
  });

  const createScraper = handlers =>
    createDlsiteScraper({
      httpClient: {
        retryGet: (url, config) => {
          calls.requests.push({ url, config });
          return handlers.retryGet(url, config);
        },
      },
      scrapeWorkMetadataFromHVDB: id => {
        calls.hvdb.push(id);
        return handlers.hvdb
          ? handlers.hvdb(id)
          : Promise.resolve({
              vas: [{ id: 'hvdb-va', name: '声优B' }],
            });
      },
      nameToUUID: name => `uuid-${name}`,
      hasLetter: value => /[a-z]/i.test(value),
      consoleLogger: {
        log: message => calls.logs.push(message),
      },
    });

  it('scrapes static metadata with the requested DLsite locale cookie', async () => {
    const { scrapeStaticWorkMetadataFromDLsite } = createScraper({
      retryGet: () => Promise.resolve({ data: createStaticHtml({ language: 'zh-cn' }) }),
    });

    const metadata = await scrapeStaticWorkMetadataFromDLsite(123, 'zh-cn');

    expect(metadata.title).to.equal('标题');
    expect(metadata.vas).to.deep.equal([{ id: 'uuid-声优A', name: '声优A' }]);
    expect(calls.requests[0].config.headers).to.deep.equal({ cookie: 'locale=zh-cn' });
  });

  it('falls back from zh-cn to zh-tw when the first static request fails', async () => {
    const { scrapeStaticWorkMetadataFromDLsite } = createScraper({
      retryGet: (url, config) => {
        if (config.headers.cookie === 'locale=zh-cn') {
          return Promise.reject(new Error('first language failed'));
        }
        return Promise.resolve({ data: createStaticHtml({ language: 'zh-tw', title: '繁中标题' }) });
      },
    });

    const metadata = await scrapeStaticWorkMetadataFromDLsite(123, 'zh-cn');

    expect(metadata.title).to.equal('繁中标题');
    expect(calls.requests.map(call => call.config.headers.cookie)).to.deep.equal(['locale=zh-cn', 'locale=zh-tw']);
  });

  it('fills missing voice actors from HVDB and filters English aliases', async () => {
    const { scrapeStaticWorkMetadataFromDLsite } = createScraper({
      retryGet: () => Promise.resolve({ data: createStaticHtml({ vas: false }) }),
      hvdb: () =>
        Promise.resolve({
          vas: [
            { id: 'english', name: 'Alice' },
            { id: 'japanese', name: '声优乙' },
          ],
        }),
    });

    const metadata = await scrapeStaticWorkMetadataFromDLsite(123, 'zh-cn');

    expect(calls.hvdb).to.deep.equal([123]);
    expect(metadata.vas).to.deep.equal([{ id: 'japanese', name: '声优乙' }]);
  });

  it('scrapes dynamic metadata from the DLsite ajax response', async () => {
    const { scrapeDynamicWorkMetadataFromDLsite } = createScraper({
      retryGet: () =>
        Promise.resolve({
          data: {
            RJ000123: {
              dl_count: 12,
              rate_average_2dp: 4.5,
              rate_count: 3,
              rate_count_detail: {},
              review_count: 2,
              price: 770,
              rank: [],
            },
          },
        }),
    });

    const metadata = await scrapeDynamicWorkMetadataFromDLsite(123);

    expect(metadata).to.include({ dl_count: 12, price: 770 });
    expect(calls.logs).to.deep.equal(['[RJ000123] 成功从 DLSite 抓取Dynamic元数据...']);
  });

  it('combines static and dynamic metadata', async () => {
    const { scrapeWorkMetadataFromDLsite } = createScraper({
      retryGet: url => {
        if (url.includes('ajax')) {
          return Promise.resolve({
            data: {
              RJ000123: {
                dl_count: 12,
                rate_average_2dp: 4.5,
                rate_count: 3,
                rate_count_detail: {},
                review_count: 2,
                price: 770,
                rank: [],
              },
            },
          });
        }
        return Promise.resolve({ data: createStaticHtml() });
      },
    });

    const metadata = await scrapeWorkMetadataFromDLsite(123, 'zh-cn');

    expect(metadata).to.include({
      id: 123,
      title: '标题',
      dl_count: 12,
      price: 770,
    });
  });
});
