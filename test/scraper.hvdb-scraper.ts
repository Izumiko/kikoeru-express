import { expect } from 'vitest';
import { createHvdbScraper } from '../src/modules/scraper/hvdb-scraper.js';

describe('createHvdbScraper', () => {
  let calls;

  beforeEach(() => {
    calls = {
      requests: [],
      logs: [],
    };
  });

  const createScraper = handlers =>
    createHvdbScraper({
      httpClient: {
        retryGet: (url, config) => {
          calls.requests.push({ url, config });
          return handlers.retryGet(url, config);
        },
      },
      nameToUUID: name => `uuid-${name}`,
      consoleLogger: {
        log: (...args) => calls.logs.push(args),
      },
    });

  it('scrapes and parses work metadata from HVDB', async () => {
    const { scrapeWorkMetadataFromHVDB } = createScraper({
      retryGet: () =>
        Promise.resolve({
          data: `
            <input id="Name" value="HVDB标题">
            <input name="SFW" value="false">
            <a href="/Dashboard/TagWorks/7">催眠</a>
            <a href="/Dashboard/CVWorks/9">声优B</a>
          `,
        }),
    });

    const metadata = await scrapeWorkMetadataFromHVDB(123);

    expect(calls.requests).to.deep.equal([
      {
        url: 'https://hvdb.me/Dashboard/WorkDetails/123',
        config: { retry: {} },
      },
    ]);
    expect(metadata).to.include({ id: 123, title: 'HVDB标题', nsfw: true });
    expect(metadata.tags).to.deep.equal([{ id: '7', name: '催眠' }]);
    expect(metadata.vas).to.deep.equal([{ id: 'uuid-声优B', name: '声优B' }]);
  });

  it('rejects when HVDB HTML contains no tags or voice actors', async () => {
    const { scrapeWorkMetadataFromHVDB } = createScraper({
      retryGet: () =>
        Promise.resolve({
          data: '<input id="Name" value="HVDB标题">',
        }),
    });

    try {
      await scrapeWorkMetadataFromHVDB(123);
      throw new Error('expected rejection');
    } catch (err) {
      expect(err.message).to.equal("Couldn't parse data from HVDB work page.");
    }
  });

  it('normalizes HTTP response errors with the requested URL and status', async () => {
    const { scrapeWorkMetadataFromHVDB } = createScraper({
      retryGet: () => Promise.reject({ response: { status: 404 } }),
    });

    try {
      await scrapeWorkMetadataFromHVDB(123);
      throw new Error('expected rejection');
    } catch (err) {
      expect(err.message).to.equal(
        "Couldn't request work page HTML (https://hvdb.me/Dashboard/WorkDetails/123), received: 404."
      );
    }
  });
});
