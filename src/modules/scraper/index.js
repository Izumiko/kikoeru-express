const httpClient = require('./http-client'); // 数据请求
const { createDlsiteScraper } = require('./dlsite-scraper');
const { createHvdbScraper } = require('./hvdb-scraper');
const { hasLetter, nameToUUID } = require('./utils');

const { scrapeWorkMetadataFromHVDB } = createHvdbScraper({
  httpClient,
  nameToUUID,
});
const { scrapeWorkMetadataFromDLsite, scrapeDynamicWorkMetadataFromDLsite } = createDlsiteScraper({
  httpClient,
  scrapeWorkMetadataFromHVDB,
  nameToUUID,
  hasLetter,
});

module.exports = {
  httpClient,
  scrapeWorkMetadataFromDLsite,
  scrapeDynamicWorkMetadataFromDLsite,
  scrapeWorkMetadataFromHVDB,
  hasLetter,
  nameToUUID,
};
