import { expect } from 'vitest';
import { applyRetryConfig, buildRetryConfig, getDefaultTimeout } from '../src/modules/scraper/retry-config.js';

describe('scraper retry config', () => {
  it('uses the legacy default timeout for non-special urls', () => {
    expect(getDefaultTimeout('https://example.com', { retry: 3 })).to.equal(10000);
  });

  it('uses DLsite and HVDB timeout settings when configured', () => {
    expect(getDefaultTimeout('https://www.dlsite.com/work', { retry: 3, dlsiteTimeout: 7000 })).to.equal(7000);
    expect(getDefaultTimeout('https://hvdb.me/work', { retry: 3, hvdbTimeout: 9000 })).to.equal(9000);
  });

  it('preserves legacy DLsite and HVDB timeout fallback to retry limit', () => {
    expect(getDefaultTimeout('https://www.dlsite.com/work', { retry: 3 })).to.equal(3);
    expect(getDefaultTimeout('https://hvdb.me/work', { retry: 4 })).to.equal(4);
  });

  it('builds retry config from app defaults and request overrides', () => {
    expect(
      buildRetryConfig(
        'https://example.com',
        {
          retry: {
            limit: 2,
            retryCount: 1,
            retryDelay: 500,
            timeout: 3000,
          },
        },
        {
          retry: 5,
          retryDelay: 2000,
        }
      )
    ).to.deep.equal({
      limit: 2,
      retryCount: 1,
      retryDelay: 500,
      timeout: 3000,
    });
  });

  it('applies retry config and disables proxy for HVDB requests', () => {
    const requestConfig = { retry: {} };

    const result = applyRetryConfig('https://hvdb.me/Dashboard/WorkDetails/123', requestConfig, {
      retry: 5,
      retryDelay: 2000,
    });

    expect(result).to.equal(requestConfig);
    expect(result.proxy).to.equal(false);
    expect(result.retry).to.deep.equal({
      limit: 5,
      retryCount: 0,
      retryDelay: 2000,
      timeout: 5,
    });
  });
});
