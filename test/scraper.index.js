/* eslint-disable node/no-unpublished-require */
const { expect } = require('chai');

describe('scraper module entrypoint', () => {
  it('exports production scraper services and keeps legacy facades compatible', () => {
    const scraper = require('../src/modules/scraper');
    const legacyDlsite = require('../scraper/dlsite');
    const legacyHvdb = require('../scraper/hvdb');

    expect(scraper.httpClient.retryGet).to.be.a('function');
    expect(scraper.nameToUUID).to.be.a('function');
    expect(scraper.scrapeWorkMetadataFromDLsite).to.be.a('function');
    expect(scraper.scrapeDynamicWorkMetadataFromDLsite).to.be.a('function');
    expect(scraper.scrapeWorkMetadataFromHVDB).to.be.a('function');
    expect(legacyDlsite.scrapeWorkMetadataFromDLsite).to.equal(scraper.scrapeWorkMetadataFromDLsite);
    expect(legacyDlsite.scrapeDynamicWorkMetadataFromDLsite).to.equal(scraper.scrapeDynamicWorkMetadataFromDLsite);
    expect(legacyHvdb).to.equal(scraper.scrapeWorkMetadataFromHVDB);
  });
});
