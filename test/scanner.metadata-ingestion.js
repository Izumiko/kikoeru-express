/* eslint-disable node/no-unpublished-require */
const { expect } = require('chai');
const { createMetadataIngestion } = require('../src/modules/scanner/metadata-ingestion');

describe('createMetadataIngestion', () => {
  let calls;

  beforeEach(() => {
    calls = {
      scrapes: [],
      inserts: [],
      taskLogs: [],
      logs: [],
      errors: [],
    };
  });

  const createIngestion = options =>
    createMetadataIngestion({
      scrapeWorkMetadataFromDLsite: (id, tagLanguage) => {
        calls.scrapes.push({ id, tagLanguage });
        return options.scrapeError
          ? Promise.reject(options.scrapeError)
          : Promise.resolve({ id, title: 'work title' });
      },
      insertWorkMetadata: metadata => {
        calls.inserts.push(metadata);
        return options.insertError ? Promise.reject(options.insertError) : Promise.resolve();
      },
      addLogForTask: (rjcode, log) => calls.taskLogs.push({ rjcode, log }),
      consoleLogger: {
        log: message => calls.logs.push(message),
        error: message => calls.errors.push(message),
      },
    });

  it('scrapes metadata, adds local folder fields, and inserts it', async () => {
    const { getMetadata } = createIngestion({});

    const result = await getMetadata(123, 'VoiceWork', 'RJ000123', 'zh-cn');

    expect(result).to.equal('added');
    expect(calls.scrapes).to.deep.equal([{ id: 123, tagLanguage: 'zh-cn' }]);
    expect(calls.inserts).to.deep.equal([
      {
        id: 123,
        title: 'work title',
        rootFolderName: 'VoiceWork',
        dir: 'RJ000123',
      },
    ]);
    expect(calls.taskLogs).to.deep.equal([
      {
        rjcode: '000123',
        log: { level: 'info', message: '从 DLSite 抓取元数据...' },
      },
      {
        rjcode: '000123',
        log: { level: 'info', message: '元数据抓取成功，准备添加到数据库...' },
      },
      {
        rjcode: '000123',
        log: { level: 'info', message: '元数据成功添加到数据库.' },
      },
    ]);
  });

  it('returns failed when inserting metadata fails', async () => {
    const { getMetadata } = createIngestion({ insertError: new Error('insert failed') });

    const result = await getMetadata(123, 'VoiceWork', 'RJ000123', 'zh-cn');

    expect(result).to.equal('failed');
    expect(calls.errors).to.deep.equal(['  ! [RJ000123] 在插入元数据过程中出错: insert failed']);
    expect(calls.taskLogs[calls.taskLogs.length - 1]).to.deep.equal({
      rjcode: '000123',
      log: {
        level: 'error',
        message: '在插入元数据过程中出错: insert failed',
      },
    });
  });

  it('returns failed when scraping metadata fails', async () => {
    const { getMetadata } = createIngestion({ scrapeError: new Error('network failed') });

    const result = await getMetadata(123, 'VoiceWork', 'RJ000123', 'zh-cn');

    expect(result).to.equal('failed');
    expect(calls.inserts).to.deep.equal([]);
    expect(calls.errors).to.deep.equal(['  ! [RJ000123] 在抓取元数据过程中出错: network failed']);
    expect(calls.taskLogs).to.deep.equal([
      {
        rjcode: '000123',
        log: { level: 'info', message: '从 DLSite 抓取元数据...' },
      },
      {
        rjcode: '000123',
        log: {
          level: 'error',
          message: '在抓取元数据过程中出错: network failed',
        },
      },
    ]);
  });
});
