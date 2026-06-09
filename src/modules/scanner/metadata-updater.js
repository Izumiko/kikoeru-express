const { formatRjCode } = require('../media/rj-code');

const shouldScrapeStaticMetadata = options =>
  Boolean(options.includeVA || options.includeTags || options.includeNSFW || options.refreshAll);

const createMetadataUpdater = ({
  tagLanguage,
  scrapeWorkMetadataFromDLsite,
  scrapeDynamicWorkMetadataFromDLsite,
  updateWorkMetadata,
  addTask,
  emitTaskLog,
}) => {
  const updateMetadata = (id, options = {}) => {
    const normalizedOptions = options || {};
    const scrapeProcessor = shouldScrapeStaticMetadata(normalizedOptions)
      ? () => scrapeWorkMetadataFromDLsite(id, tagLanguage)
      : () => scrapeDynamicWorkMetadataFromDLsite(id);

    const rjcode = formatRjCode(id);
    addTask(rjcode);

    return scrapeProcessor()
      .then(metadata => {
        emitTaskLog(` -> [RJ${rjcode}] 元数据抓取成功，准备更新元数据...`, rjcode);
        metadata.id = id;
        return updateWorkMetadata(metadata, normalizedOptions).then(() => {
          emitTaskLog(` -> [RJ${rjcode}] 元数据更新成功`, rjcode);
          return 'updated';
        });
      })
      .catch(err => {
        emitTaskLog(`  ! [RJ${rjcode}] 在抓取元数据过程中出错: ${err}`, rjcode, 'error');
        return 'failed';
      });
  };

  return { updateMetadata };
};

module.exports = {
  createMetadataUpdater,
  shouldScrapeStaticMetadata,
};
