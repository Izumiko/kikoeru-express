import { expect } from 'vitest';
import { createCoverDownloader } from '../src/modules/scanner/workers/cover-downloader.js';

const createDownloader = ({ responses, saveCoverImageToDisk = () => Promise.resolve() }) => {
  const requests = [];
  const logs = [];
  const taskLogs = [];
  const axios = {
    retryGet: (url, options) => {
      requests.push({ url, options });
      const response = responses.shift();
      if (response instanceof Error) {
        return Promise.reject(response);
      }
      return Promise.resolve(response);
    },
  };

  const downloader = createCoverDownloader({
    axios,
    saveCoverImageToDisk,
    addLogForTask: (rjcode, log) => taskLogs.push({ rjcode, log }),
    consoleLogger: {
      log: message => logs.push(['log', message]),
      error: message => logs.push(['error', message]),
    },
  });

  return {
    downloader,
    requests,
    logs,
    taskLogs,
  };
};

describe('createCoverDownloader', () => {
  it('downloads and saves cover images from the primary DLsite image url', async () => {
    const saved = [];
    const { downloader, requests, taskLogs } = createDownloader({
      responses: [{ data: 'image-stream' }],
      saveCoverImageToDisk: (stream, rjcode, type) => {
        saved.push({ stream, rjcode, type });
        return Promise.resolve();
      },
    });

    const result = await downloader.getCoverImage(123, ['main']);

    expect(result).to.equal('added');
    expect(requests[0].url).to.equal(
      'https://img.dlsite.jp/modpub/images2/work/doujin/RJ001000/RJ000123_img_main.jpg'
    );
    expect(saved).to.deep.equal([{ stream: 'image-stream', rjcode: '000123', type: 'main' }]);
    expect(taskLogs).to.deep.equal([
      { rjcode: '000123', log: { level: 'info', message: '从 DLsite 下载封面...' } },
      { rjcode: '000123', log: { level: 'info', message: '封面 RJ000123_img_main.jpg 下载成功.' } },
    ]);
  });

  it('uses the resize url for thumbnail cover types', async () => {
    const { downloader, requests } = createDownloader({
      responses: [{ data: 'image-stream' }],
    });

    await downloader.getCoverImage(1000, ['240x240']);

    expect(requests[0].url).to.equal(
      'https://img.dlsite.jp/resize/images2/work/doujin/RJ001000/RJ001000_img_main_240x240.jpg'
    );
  });

  it('falls back to the work page image template after primary image download fails', async () => {
    const saved = [];
    const html =
      '<div class="slider_body"><ul><li><picture><img srcset="//img.dlsite.jp/modpub/images2/work/doujin/RJ009000/RJ008888_img_main.jpg"></picture></li></ul></div>';
    const { downloader, requests } = createDownloader({
      responses: [new Error('primary failed'), { data: html }, { data: 'fallback-stream' }],
      saveCoverImageToDisk: (stream, rjcode, type) => {
        saved.push({ stream, rjcode, type });
        return Promise.resolve();
      },
    });

    const result = await downloader.getCoverImage(123, ['sam']);

    expect(result).to.equal('added');
    expect(requests[1].url).to.equal('https://www.dlsite.com/maniax/work/=/product_id/RJ000123.html');
    expect(requests[2].url).to.equal('https://img.dlsite.jp/modpub/images2/work/doujin/RJ009000/RJ008888_img_sam.jpg');
    expect(saved).to.deep.equal([{ stream: 'fallback-stream', rjcode: '000123', type: 'sam' }]);
  });

  it('preserves the legacy overall added result even when a cover type fails', async () => {
    const { downloader, taskLogs } = createDownloader({
      responses: [new Error('primary failed'), new Error('page failed')],
    });

    const result = await downloader.getCoverImage(123, ['main']);

    expect(result).to.equal('added');
    expect(taskLogs[1]).to.deep.equal({
      rjcode: '000123',
      log: {
        level: 'error',
        message: '在下载封面 RJ000123_img_main.jpg 过程中出错: primary failed',
      },
    });
  });
});
