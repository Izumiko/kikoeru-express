/* eslint-disable node/no-unpublished-require */
const { expect } = require('chai');
const { dedupeFoldersById } = require('../src/modules/scanner/folder-dedupe');

describe('dedupeFoldersById', () => {
  it('keeps unique folders unchanged', () => {
    const folders = [
      { id: 1, relativePath: 'RJ000001' },
      { id: 2, relativePath: 'RJ000002' },
    ];

    expect(dedupeFoldersById(folders)).to.deep.equal({
      uniqueArr: folders,
      duplicate: {},
    });
  });

  it('preserves the legacy behavior of keeping the last duplicate folder', () => {
    const first = { id: 1, relativePath: 'old/RJ000001' };
    const second = { id: 1, relativePath: 'new/RJ000001' };
    const other = { id: 2, relativePath: 'RJ000002' };

    expect(dedupeFoldersById([first, second, other])).to.deep.equal({
      uniqueArr: [second, other],
      duplicate: {
        1: [first],
      },
    });
  });

  it('records all skipped folders when more than two folders share an id', () => {
    const first = { id: 1, relativePath: 'a/RJ000001' };
    const second = { id: 1, relativePath: 'b/RJ000001' };
    const third = { id: 1, relativePath: 'c/RJ000001' };

    expect(dedupeFoldersById([first, second, third])).to.deep.equal({
      uniqueArr: [third],
      duplicate: {
        1: [first, second],
      },
    });
  });
});
