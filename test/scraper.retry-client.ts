// @ts-nocheck
import { expect } from 'chai';
import { createRetryGet, getRetryUrl } from '../src/modules/scraper/retry-client.js';

describe('scraper retry client', () => {
  let calls;

  beforeEach(() => {
    calls = {
      httpGets: [],
      cancels: [],
      timeouts: [],
      clearedTimeouts: [],
      delays: [],
      logs: [],
    };
  });

  const createClient = httpGet =>
    createRetryGet({
      httpGet: (url, config) => {
        calls.httpGets.push({ url, config });
        return httpGet(url, config);
      },
      cancelTokenSource: () => ({
        token: `token-${calls.timeouts.length}`,
        cancel: message => calls.cancels.push(message),
      }),
      applyRetryConfig: (url, config) => {
        config.retry = config.retry || {
          limit: 1,
          retryCount: 0,
          retryDelay: 5,
          timeout: 10,
        };
      },
      appConfig: {},
      delay: ms => {
        calls.delays.push(ms);
        return Promise.resolve();
      },
      setTimeoutFn: (fn, ms) => {
        calls.timeouts.push({ fn, ms });
        return `timeout-${calls.timeouts.length}`;
      },
      clearTimeoutFn: id => calls.clearedTimeouts.push(id),
      consoleLogger: {
        log: message => calls.logs.push(message),
      },
    });

  it('returns successful responses and clears the timeout', async () => {
    const retryGet = createClient(() => Promise.resolve({ data: 'ok' }));

    const response = await retryGet('https://example.com', {});

    expect(response).to.deep.equal({ data: 'ok' });
    expect(calls.httpGets[0].config.cancelToken).to.equal('token-0');
    expect(calls.timeouts[0].ms).to.equal(10);
    expect(calls.clearedTimeouts).to.deep.equal(['timeout-1']);
  });

  it('retries network errors and reuses redirected request path when present', async () => {
    let attempts = 0;
    const retryGet = createClient(url => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject({
          request: {
            _currentRequest: {
              path: 'https://forwarded.example.com/work',
            },
          },
        });
      }
      return Promise.resolve({ data: url });
    });

    const response = await retryGet('https://example.com/work', {});

    expect(response).to.deep.equal({ data: 'https://forwarded.example.com/work' });
    expect(calls.delays).to.deep.equal([5]);
    expect(calls.logs).to.deep.equal(['https://example.com/work 第 1 次重试请求']);
    expect(calls.httpGets.map(call => call.url)).to.deep.equal([
      'https://example.com/work',
      'https://forwarded.example.com/work',
    ]);
  });

  it('does not retry response errors', async () => {
    const error = { response: { status: 500 } };
    const retryGet = createClient(() => Promise.reject(error));

    try {
      await retryGet('https://example.com', {});
      throw new Error('expected rejection');
    } catch (err) {
      expect(err).to.equal(error);
    }

    expect(calls.httpGets).to.have.length(1);
    expect(calls.delays).to.deep.equal([]);
  });

  it('resolves retry urls from forwarded requests', () => {
    expect(
      getRetryUrl(
        {
          request: {
            _currentRequest: {
              path: 'https://forwarded.example.com',
            },
          },
        },
        'https://fallback.example.com'
      )
    ).to.equal('https://forwarded.example.com');
    expect(getRetryUrl({}, 'https://fallback.example.com')).to.equal('https://fallback.example.com');
  });
});
