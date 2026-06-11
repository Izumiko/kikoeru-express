import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { expect } from 'vitest';
import { config } from '../src/config/index.js';
import { deleteCoverImageFromDisk, saveCoverImageToDisk } from '../src/modules/media/cover-storage.js';

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kikoeru-cover-test-'));

describe('media cover storage', () => {
  let tempDir;
  let originalCoverFolderDir;

  beforeEach(() => {
    tempDir = makeTempDir();
    originalCoverFolderDir = config.coverFolderDir;
    config.coverFolderDir = tempDir;
  });

  afterEach(() => {
    config.coverFolderDir = originalCoverFolderDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('saves cover image streams using the legacy file naming contract', async () => {
    await saveCoverImageToDisk(Readable.from(['cover-data']), '000123', 'main');

    const coverPath = path.join(tempDir, 'RJ000123_img_main.jpg');
    expect(fs.readFileSync(coverPath, 'utf8')).to.equal('cover-data');
  });

  it('deletes all generated cover variants for a work', async () => {
    const types = ['main', 'sam', '240x240', '360x360'];
    types.forEach((type) => {
      fs.writeFileSync(path.join(tempDir, `RJ000123_img_${type}.jpg`), type);
    });

    await deleteCoverImageFromDisk('000123');

    types.forEach((type) => {
      expect(fs.existsSync(path.join(tempDir, `RJ000123_img_${type}.jpg`))).to.equal(false);
    });
  });
});
