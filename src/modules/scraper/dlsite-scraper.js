const { formatRjCode } = require('../media/rj-code');
const {
  buildDlsiteDynamicMetadataUrl,
  buildDlsiteWorkUrl,
  getDlsiteLanguageConfig,
  parseDynamicWorkMetadata,
  parseStaticWorkMetadataHtml,
} = require('./dlsite-metadata');

const createDlsiteScraper = ({
  httpClient,
  scrapeWorkMetadataFromHVDB,
  nameToUUID,
  hasLetter,
  consoleLogger = console,
}) => {
  const addHvdbVoiceActors = async (id, work) => {
    if (work.vas.length !== 0) {
      return work;
    }

    const metadata = await scrapeWorkMetadataFromHVDB(id);
    if (metadata.vas.length <= 1) {
      work.vas = metadata.vas;
    } else {
      metadata.vas.forEach(va => {
        if (!hasLetter(va.name)) {
          work.vas.push(va);
        }
      });
    }

    return work;
  };

  const scrapeStaticWorkMetadataOnce = async (id, language) => {
    const url = buildDlsiteWorkUrl(id);
    const dlsiteLanguage = getDlsiteLanguageConfig(language);
    const response = await httpClient.retryGet(url, {
      retry: {},
      headers: { cookie: dlsiteLanguage.cookieLocale },
    });
    const work = parseStaticWorkMetadataHtml({
      html: response.data,
      id,
      url,
      languageConfig: dlsiteLanguage,
      nameToUUID,
    });

    if (work.tags.length === 0 && work.vas.length === 0) {
      throw new Error("Couldn't parse data from DLsite work page.");
    }

    return addHvdbVoiceActors(id, work);
  };

  const scrapeStaticWorkMetadataFromDLsite = async (id, language, successLanguage = {}) => {
    const rjcode = formatRjCode(id);
    const url = buildDlsiteWorkUrl(id);

    try {
      const work = await scrapeStaticWorkMetadataOnce(id, language);
      successLanguage.language = language;
      return work;
    } catch (error) {
      try {
        const fallbackState = successLanguage || {
          language: null,
          initLanguage: language,
        };
        if (language === 'zh-cn') {
          const metadata = await scrapeStaticWorkMetadataFromDLsite(id, 'zh-tw', fallbackState);
          if (fallbackState.initLanguage === language) {
            consoleLogger.log(`[RJ${rjcode}] 成功从 DLsite (${fallbackState.language}) 下载原数据`);
          }
          return metadata;
        } else if (language === 'zh-tw') {
          const metadata = await scrapeStaticWorkMetadataFromDLsite(id, 'ja-jp', fallbackState);
          if (fallbackState.initLanguage === language) {
            consoleLogger.log(`[RJ${rjcode}] 成功从 DLsite (${fallbackState.language}) 下载原数据`);
          }
          return metadata;
        }
      } catch {
        // Keep the first error as the observable failure, matching the legacy fallback path.
      }

      if (error.response) {
        throw new Error(`Couldn't request work page HTML (${url}), received: ${error.response.status}.`);
      }
      throw error;
    }
  };

  const scrapeDynamicWorkMetadataFromDLsite = async id => {
    const rjcode = formatRjCode(id);
    const url = buildDlsiteDynamicMetadataUrl(id);

    try {
      const response = await httpClient.retryGet(url, { retry: {} });
      const work = parseDynamicWorkMetadata(response.data[`RJ${rjcode}`]);
      consoleLogger.log(`[RJ${rjcode}] 成功从 DLSite 抓取Dynamic元数据...`);
      return work;
    } catch (error) {
      if (error.response) {
        throw new Error(`Couldn't request work page HTML (${url}), received: ${error.response.status}.`);
      }
      throw error;
    }
  };

  const scrapeWorkMetadataFromDLsite = (id, language) =>
    Promise.all([scrapeStaticWorkMetadataFromDLsite(id, language), scrapeDynamicWorkMetadataFromDLsite(id)]).then(res =>
      Object.assign({}, res[0], res[1])
    );

  return {
    addHvdbVoiceActors,
    scrapeDynamicWorkMetadataFromDLsite,
    scrapeStaticWorkMetadataFromDLsite,
    scrapeStaticWorkMetadataOnce,
    scrapeWorkMetadataFromDLsite,
  };
};

module.exports = { createDlsiteScraper };
