import { expect } from 'vitest';
import httpClient from '../src/modules/scraper/http-client.js';

describe('scraper http client', () => {
  it('exports the retry-capable src client', () => {
    expect(httpClient.retryGet).to.be.a('function');
  });
});
