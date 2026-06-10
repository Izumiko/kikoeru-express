/* eslint-disable node/no-unpublished-require */
const { expect } = require('chai');

describe('scraper http client', () => {
  it('keeps the legacy scraper axios entrypoint wired to the src client', () => {
    const httpClient = require('../src/modules/scraper/http-client');
    const legacyClient = require('../scraper/axios');

    expect(legacyClient).to.equal(httpClient);
    expect(httpClient.retryGet).to.be.a('function');
  });
});
