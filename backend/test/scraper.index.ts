import { expect } from 'vitest';
import * as scraper from '../src/modules/scraper/index.js';

describe('scraper module entrypoint', () => {
  it('exports production scraper services', () => {
    expect(scraper.httpClient.retryGet).to.be.a('function');
    expect(scraper.nameToUUID).to.be.a('function');
    expect(scraper.scrapeWorkMetadataFromDLsite).to.be.a('function');
    expect(scraper.scrapeDynamicWorkMetadataFromDLsite).to.be.a('function');
    expect(scraper.scrapeWorkMetadataFromHVDB).to.be.a('function');
  });
});
