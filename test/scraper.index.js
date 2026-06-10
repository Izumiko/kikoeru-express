const { expect } = require('chai');

describe('scraper module entrypoint', () => {
  it('exports production scraper services', () => {
    const scraper = require('../src/modules/scraper');

    expect(scraper.httpClient.retryGet).to.be.a('function');
    expect(scraper.nameToUUID).to.be.a('function');
    expect(scraper.scrapeWorkMetadataFromDLsite).to.be.a('function');
    expect(scraper.scrapeDynamicWorkMetadataFromDLsite).to.be.a('function');
    expect(scraper.scrapeWorkMetadataFromHVDB).to.be.a('function');
  });
});
