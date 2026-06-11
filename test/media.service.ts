import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect } from 'vitest';
import { config } from '../config.js';
import { formatRjCode, getFolderList, getTrackList, toTree } from '../src/modules/media/service.js';

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kikoeru-media-test-'));

const writeFile = filePath => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'test');
};

describe('media service', () => {
  let tempDir;
  let originalConfig;

  beforeEach(() => {
    tempDir = makeTempDir();
    originalConfig = {
      offloadMedia: config.offloadMedia,
      offloadStreamPath: config.offloadStreamPath,
      offloadDownloadPath: config.offloadDownloadPath,
      scannerMaxRecursionDepth: config.scannerMaxRecursionDepth,
    };
  });

  afterEach(() => {
    config.offloadMedia = originalConfig.offloadMedia;
    config.offloadStreamPath = originalConfig.offloadStreamPath;
    config.offloadDownloadPath = originalConfig.offloadDownloadPath;
    config.scannerMaxRecursionDepth = originalConfig.scannerMaxRecursionDepth;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('formatRjCode', () => {
    it('pads legacy and extended RJ ids', () => {
      expect(formatRjCode(123)).to.equal('000123');
      expect(formatRjCode(157474)).to.equal('157474');
      expect(formatRjCode(1234567)).to.equal('01234567');
      expect(formatRjCode(123456789)).to.equal('0123456789');
      expect(formatRjCode(1234567890)).to.equal('1234567890');
    });
  });

  describe('getTrackList', () => {
    it('returns playable media and metadata files in deterministic order', async () => {
      writeFile(path.join(tempDir, '02.flac'));
      writeFile(path.join(tempDir, '01.mp3'));
      writeFile(path.join(tempDir, 'ignore.exe'));
      writeFile(path.join(tempDir, 'extras', 'cover.jpg'));
      writeFile(path.join(tempDir, 'extras', 'notes.txt'));

      const tracks = await getTrackList(123, tempDir);

      expect(tracks).to.deep.equal([
        { title: 'cover.jpg', subtitle: 'extras', hash: '123/0', ext: '.jpg' },
        { title: 'notes.txt', subtitle: 'extras', hash: '123/1', ext: '.txt' },
        { title: '01.mp3', subtitle: null, hash: '123/2', ext: '.mp3' },
        { title: '02.flac', subtitle: null, hash: '123/3', ext: '.flac' },
      ]);
    });
  });

  describe('toTree', () => {
    it('builds media nodes with API stream and download urls', () => {
      config.offloadMedia = false;

      const tree = toTree(
        [
          { title: '01.mp3', subtitle: null, hash: '123/0', ext: '.mp3' },
          { title: 'book.pdf', subtitle: null, hash: '123/1', ext: '.pdf' },
          { title: 'line.lrc', subtitle: 'sub', hash: '123/2', ext: '.lrc' },
          { title: 'cover.jpg', subtitle: 'sub', hash: '123/3', ext: '.jpg' },
        ],
        'Work Title',
        'RJ000123',
        { name: 'VoiceWork', path: tempDir }
      );

      expect(tree).to.deep.equal([
        {
          type: 'folder',
          title: 'sub',
          children: [
            {
              type: 'text',
              hash: '123/2',
              title: 'line.lrc',
              workTitle: 'Work Title',
              mediaStreamUrl: '/api/media/stream/123/2',
              mediaDownloadUrl: '/api/media/download/123/2',
            },
            {
              type: 'image',
              hash: '123/3',
              title: 'cover.jpg',
              workTitle: 'Work Title',
              mediaStreamUrl: '/api/media/stream/123/3',
              mediaDownloadUrl: '/api/media/download/123/3',
            },
          ],
        },
        {
          type: 'audio',
          hash: '123/0',
          title: '01.mp3',
          workTitle: 'Work Title',
          mediaStreamUrl: '/api/media/stream/123/0',
          mediaDownloadUrl: '/api/media/download/123/0',
        },
        {
          type: 'other',
          hash: '123/1',
          title: 'book.pdf',
          workTitle: 'Work Title',
          mediaStreamUrl: '/api/media/stream/123/1',
          mediaDownloadUrl: '/api/media/download/123/1',
        },
      ]);
    });

    it('uses offload urls for media downloads while text streams stay on the API endpoint', () => {
      config.offloadMedia = true;
      config.offloadStreamPath = '/media/stream';
      config.offloadDownloadPath = '/media/download';

      const tree = toTree(
        [
          { title: '01.mp3', subtitle: 'sub', hash: '123/0', ext: '.mp3' },
          { title: 'line.lrc', subtitle: 'sub', hash: '123/1', ext: '.lrc' },
        ],
        'Work Title',
        'RJ000123',
        { name: 'VoiceWork', path: tempDir }
      );

      expect(tree[0].children).to.deep.equal([
        {
          type: 'audio',
          hash: '123/0',
          title: '01.mp3',
          workTitle: 'Work Title',
          mediaStreamUrl: '/media/stream/VoiceWork/RJ000123/sub/01.mp3',
          mediaDownloadUrl: '/media/download/VoiceWork/RJ000123/sub/01.mp3',
        },
        {
          type: 'text',
          hash: '123/1',
          title: 'line.lrc',
          workTitle: 'Work Title',
          mediaStreamUrl: '/api/media/stream/123/1',
          mediaDownloadUrl: '/media/download/VoiceWork/RJ000123/sub/line.lrc',
        },
      ]);
    });
  });

  describe('getFolderList', () => {
    it('finds RJ work folders within the configured recursion depth', async () => {
      config.scannerMaxRecursionDepth = 3;
      fs.mkdirSync(path.join(tempDir, 'nested', 'RJ000123'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'nested', 'plain'), { recursive: true });

      const folders = [];
      for await (const folder of getFolderList({ name: 'VoiceWork', path: tempDir })) {
        folders.push(folder);
      }

      expect(folders).to.deep.equal([
        {
          absolutePath: path.resolve(tempDir, 'nested', 'RJ000123'),
          relativePath: path.join('nested', 'RJ000123'),
          rootFolderName: 'VoiceWork',
          id: 123,
        },
      ]);
    });
  });
});
