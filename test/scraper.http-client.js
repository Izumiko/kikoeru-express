const { expect } = require('chai');

describe('scraper http client', () => {
  it('exports the retry-capable src client', () => {
    const httpClient = require('../src/modules/scraper/http-client');

    expect(httpClient.retryGet).to.be.a('function');
  });
});
