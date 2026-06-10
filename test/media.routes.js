const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');
const { config } = require('../config');
const db = require('../src/database');
const mediaRouter = require('../src/modules/media/routes');
const { request } = require('./helpers/http');

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kikoeru-media-route-test-'));

const writeFile = (filePath, content = 'test') => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
};

describe('media routes', () => {
  let app;
  let tempDir;
  let originalConfig;
  let originalGetWorkStorageLocation;

  beforeEach(() => {
    app = express();
    app.use(mediaRouter);
    tempDir = makeTempDir();
    originalConfig = {
      rootFolders: config.rootFolders,
      offloadMedia: config.offloadMedia,
      offloadStreamPath: config.offloadStreamPath,
      offloadDownloadPath: config.offloadDownloadPath,
    };
    originalGetWorkStorageLocation = db.getWorkStorageLocation;
    config.rootFolders = [{ name: 'VoiceWork', path: tempDir }];
    config.offloadMedia = false;
    config.offloadStreamPath = '/media/stream';
    config.offloadDownloadPath = '/media/download';
    db.getWorkStorageLocation = () => Promise.resolve({ root_folder: 'VoiceWork', dir: 'RJ000123' });
  });

  afterEach(() => {
    db.getWorkStorageLocation = originalGetWorkStorageLocation;
    config.rootFolders = originalConfig.rootFolders;
    config.offloadMedia = originalConfig.offloadMedia;
    config.offloadStreamPath = originalConfig.offloadStreamPath;
    config.offloadDownloadPath = originalConfig.offloadDownloadPath;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('streams text tracks with charset-aware text content type', async () => {
    writeFile(path.join(tempDir, 'RJ000123', 'line.lrc'), '[00:00.000]hello');

    const res = await request(app, { path: '/media/stream/123/0' });

    expect(res.statusCode).to.equal(200);
    expect(res.headers['content-type']).to.match(/^text\/plain; charset=/);
    expect(res.text).to.equal('[00:00.000]hello');
  });

  it('sets the legacy flac content type when streaming flac tracks', async () => {
    writeFile(path.join(tempDir, 'RJ000123', '01.flac'), 'flac-data');

    const res = await request(app, { path: '/media/stream/123/0' });

    expect(res.statusCode).to.equal(200);
    expect(res.headers['content-type']).to.equal('audio/flac');
    expect(res.text).to.equal('flac-data');
  });

  it('redirects stream and download requests to offload urls when enabled', async () => {
    config.offloadMedia = true;
    writeFile(path.join(tempDir, 'RJ000123', 'sub', '01.mp3'), 'mp3-data');

    const streamRes = await request(app, { path: '/media/stream/123/0' });
    const downloadRes = await request(app, { path: '/media/download/123/0' });

    expect(streamRes.statusCode).to.equal(302);
    expect(streamRes.headers.location).to.equal('/media/stream/VoiceWork/RJ000123/sub/01.mp3');
    expect(downloadRes.statusCode).to.equal(302);
    expect(downloadRes.headers.location).to.equal('/media/download/VoiceWork/RJ000123/sub/01.mp3');
  });

  it('keeps text streams on the API endpoint even when offload is enabled', async () => {
    config.offloadMedia = true;
    writeFile(path.join(tempDir, 'RJ000123', 'line.lrc'), '[00:00.000]hello');

    const res = await request(app, { path: '/media/stream/123/0' });

    expect(res.statusCode).to.equal(200);
    expect(res.text).to.equal('[00:00.000]hello');
  });

  it('finds matching subtitle tracks by base filename', async () => {
    writeFile(path.join(tempDir, 'RJ000123', '01.mp3'), 'mp3-data');
    writeFile(path.join(tempDir, 'RJ000123', '01.lrc'), '[00:00.000]hello');

    const res = await request(app, { path: '/media/check-lrc/123/1' });

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.deep.equal({ result: true, message: '找到歌词文件', hash: '123/0' });
  });

  it('lists WebVTT text subtitles and ignores plain text notes', async () => {
    writeFile(path.join(tempDir, 'RJ000123', '01.mp3'), 'mp3-data');
    writeFile(path.join(tempDir, 'RJ000123', 'caption.txt'), 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhello');
    writeFile(path.join(tempDir, 'RJ000123', 'notes.txt'), 'plain notes');

    const res = await request(app, { path: '/media/find-all-lrc/123/0' });

    expect(res.statusCode).to.equal(200);
    expect(res.body.result).to.equal(true);
    expect(res.body.subtitlesItems).to.deep.equal([
      { title: 'caption.txt', subtitle: null, hash: '123/1', ext: '.txt' },
    ]);
  });
});
