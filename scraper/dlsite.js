const axios = require('./axios'); // 数据请求
const { nameToUUID, hasLetter } = require('./utils');
const scrapeWorkMetadataFromHVDB = require('./hvdb');
const { createDlsiteScraper } = require('../src/modules/scraper/dlsite-scraper');

const { scrapeWorkMetadataFromDLsite, scrapeDynamicWorkMetadataFromDLsite } = createDlsiteScraper({
  httpClient: axios,
  scrapeWorkMetadataFromHVDB,
  nameToUUID,
  hasLetter,
});

module.exports = {
  scrapeWorkMetadataFromDLsite,
  scrapeDynamicWorkMetadataFromDLsite,
};
