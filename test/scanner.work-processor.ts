import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect } from 'vitest';
import { createWorkProcessor } from '../src/modules/scanner/work-processor.js';

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kikoeru-work-processor-test-'));

describe('createWorkProcessor', () => {
  let tempDir;
  let calls;

  beforeEach(() => {
    tempDir = makeTempDir();
    calls = {
      tasks: [],
      taskLogs: [],
      metadata: [],
      covers: [],
      logs: [],
    };
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const createProcessor = options =>
    createWorkProcessor({
      workExists: () => Promise.resolve(Boolean(options.exists)),
      coverFolderDir: tempDir,
      tagLanguage: 'zh-cn',
      getMetadata: (...args) => {
        calls.metadata.push(args);
        return Promise.resolve(options.metadataResult || 'added');
      },
      getCoverImage: (...args) => {
        calls.covers.push(args);
        return Promise.resolve(options.coverResult || 'added');
      },
      addTask: rjcode => calls.tasks.push(rjcode),
      addLogForTask: (rjcode, log) => calls.taskLogs.push({ rjcode, log }),
      consoleLogger: {
        log: message => calls.logs.push(message),
      },
    });

  it('skips existing works when all cover files exist', async () => {
    ['main', 'sam', '240x240'].forEach(type => {
      fs.writeFileSync(path.join(tempDir, `RJ000123_img_${type}.jpg`), type);
    });
    const { processFolder } = createProcessor({ exists: true });

    const result = await processFolder({ id: 123, absolutePath: 'VoiceWork/RJ000123' });

    expect(result).to.equal('skipped');
    expect(calls.tasks).to.deep.equal([]);
    expect(calls.covers).to.deep.equal([]);
  });

  it('downloads missing covers for existing works', async () => {
    fs.writeFileSync(path.join(tempDir, 'RJ000123_img_main.jpg'), 'main');
    const { processFolder } = createProcessor({ exists: true });

    const result = await processFolder({ id: 123, absolutePath: 'VoiceWork/RJ000123' });

    expect(result).to.equal('added');
    expect(calls.tasks).to.deep.equal(['000123']);
    expect(calls.covers).to.deep.equal([[123, ['sam', '240x240']]]);
  });

  it('adds metadata before downloading covers for new works', async () => {
    const { processFolder } = createProcessor({ exists: false });
    const folder = {
      id: 123,
      rootFolderName: 'VoiceWork',
      relativePath: 'RJ000123',
      absolutePath: 'VoiceWork/RJ000123',
    };

    const result = await processFolder(folder);

    expect(result).to.equal('added');
    expect(calls.metadata).to.deep.equal([[123, 'VoiceWork', 'RJ000123', 'zh-cn']]);
    expect(calls.covers).to.deep.equal([[123, ['main', 'sam', '240x240']]]);
  });

  it('does not download covers when metadata collection fails', async () => {
    const { processFolder } = createProcessor({ exists: false, metadataResult: 'failed' });

    const result = await processFolder({
      id: 123,
      rootFolderName: 'VoiceWork',
      relativePath: 'RJ000123',
      absolutePath: 'VoiceWork/RJ000123',
    });

    expect(result).to.equal('failed');
    expect(calls.covers).to.deep.equal([]);
  });
});
