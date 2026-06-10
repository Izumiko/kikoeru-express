// @ts-nocheck
import { expect } from 'chai';
import {
  createMetadataUpdater,
  shouldScrapeStaticMetadata,
} from '../src/modules/scanner/metadata-updater.js';

describe('createMetadataUpdater', () => {
  let calls;

  beforeEach(() => {
    calls = {
      staticScrapes: [],
      dynamicScrapes: [],
      updates: [],
      tasks: [],
      taskLogs: [],
    };
  });

  const createUpdater = options =>
    createMetadataUpdater({
      tagLanguage: 'zh-cn',
      scrapeWorkMetadataFromDLsite: (id, tagLanguage) => {
        calls.staticScrapes.push({ id, tagLanguage });
        return options.staticError
          ? Promise.reject(options.staticError)
          : Promise.resolve({ title: 'static metadata' });
      },
      scrapeDynamicWorkMetadataFromDLsite: id => {
        calls.dynamicScrapes.push(id);
        return options.dynamicError
          ? Promise.reject(options.dynamicError)
          : Promise.resolve({ title: 'dynamic metadata' });
      },
      updateWorkMetadata: (metadata, updateOptions) => {
        calls.updates.push({ metadata, updateOptions });
        return Promise.resolve();
      },
      addTask: rjcode => calls.tasks.push(rjcode),
      emitTaskLog: (message, rjcode, level) => calls.taskLogs.push({ message, rjcode, level }),
    });

  it('uses dynamic metadata by default and normalizes null options', async () => {
    const { updateMetadata } = createUpdater({});

    const result = await updateMetadata(123, null);

    expect(result).to.equal('updated');
    expect(calls.tasks).to.deep.equal(['000123']);
    expect(calls.dynamicScrapes).to.deep.equal([123]);
    expect(calls.staticScrapes).to.deep.equal([]);
    expect(calls.updates).to.deep.equal([
      {
        metadata: { title: 'dynamic metadata', id: 123 },
        updateOptions: {},
      },
    ]);
  });

  it('uses static metadata when full fields are requested', async () => {
    const { updateMetadata } = createUpdater({});

    const result = await updateMetadata(123, { includeTags: true });

    expect(result).to.equal('updated');
    expect(calls.staticScrapes).to.deep.equal([{ id: 123, tagLanguage: 'zh-cn' }]);
    expect(calls.dynamicScrapes).to.deep.equal([]);
    expect(calls.updates[0].updateOptions).to.deep.equal({ includeTags: true });
  });

  it('returns failed when metadata scraping fails', async () => {
    const { updateMetadata } = createUpdater({ dynamicError: new Error('network failure') });

    const result = await updateMetadata(123);

    expect(result).to.equal('failed');
    expect(calls.updates).to.deep.equal([]);
    expect(calls.taskLogs[calls.taskLogs.length - 1]).to.deep.equal({
      message: '  ! [RJ000123] 在抓取元数据过程中出错: Error: network failure',
      rjcode: '000123',
      level: 'error',
    });
  });
});

describe('shouldScrapeStaticMetadata', () => {
  it('detects options that require static metadata', () => {
    expect(shouldScrapeStaticMetadata({})).to.equal(false);
    expect(shouldScrapeStaticMetadata({ includeVA: true })).to.equal(true);
    expect(shouldScrapeStaticMetadata({ includeTags: true })).to.equal(true);
    expect(shouldScrapeStaticMetadata({ includeNSFW: true })).to.equal(true);
    expect(shouldScrapeStaticMetadata({ refreshAll: true })).to.equal(true);
  });
});
