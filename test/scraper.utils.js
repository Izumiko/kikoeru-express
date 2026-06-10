/* eslint-disable node/no-unpublished-require */
const { expect } = require('chai');
const { NAME_UUID_NAMESPACE, hasLetter, nameToUUID } = require('../src/modules/scraper/utils');
const legacyUtils = require('../scraper/utils');

describe('scraper utils', () => {
  it('keeps the legacy UUID namespace for voice actor names', () => {
    expect(NAME_UUID_NAMESPACE).to.equal('699d9c07-b965-4399-bafd-18a3cacf073c');
    expect(nameToUUID('声优A')).to.equal('5c781089-f80d-53ab-811a-87af1de8874c');
  });

  it('detects only ASCII letters like the legacy helper', () => {
    expect(hasLetter('Alice')).to.equal(true);
    expect(hasLetter('声优A')).to.equal(true);
    expect(hasLetter('声优乙')).to.equal(false);
    expect(hasLetter('かな')).to.equal(false);
  });

  it('keeps the old scraper utils facade compatible', () => {
    expect(legacyUtils.nameToUUID).to.equal(nameToUUID);
    expect(legacyUtils.hasLetter).to.equal(hasLetter);
  });
});
