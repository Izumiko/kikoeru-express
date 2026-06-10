// @ts-nocheck
import httpClient from './http-client.js'; // 数据请求
import { createDlsiteScraper } from './dlsite-scraper.js';
import { createHvdbScraper } from './hvdb-scraper.js';
import { hasLetter, nameToUUID } from './utils.js';

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

export {
  httpClient,
  scrapeWorkMetadataFromDLsite,
  scrapeDynamicWorkMetadataFromDLsite,
  scrapeWorkMetadataFromHVDB,
  hasLetter,
  nameToUUID,
};
