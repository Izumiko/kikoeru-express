const httpClient = require('./axios'); // 数据请求
const { nameToUUID } = require('./utils');
const { createHvdbScraper } = require('../src/modules/scraper/hvdb-scraper');

const { scrapeWorkMetadataFromHVDB } = createHvdbScraper({
  httpClient,
  nameToUUID,
});

module.exports = scrapeWorkMetadataFromHVDB;
