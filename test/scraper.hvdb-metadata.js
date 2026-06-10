/* eslint-disable node/no-unpublished-require */
const { expect } = require('chai');
const { buildHvdbWorkUrl, parseHvdbWorkMetadataHtml } = require('../src/modules/scraper/hvdb-metadata');

describe('hvdb metadata helpers', () => {
  it('builds the legacy HVDB work url', () => {
    expect(buildHvdbWorkUrl(123)).to.equal('https://hvdb.me/Dashboard/WorkDetails/123');
  });

  it('parses work metadata from HVDB HTML', () => {
    const html = `
      <input id="Name" value="HVDB标题">
      <input name="SFW" value="false">
      <a href="/Dashboard/CircleWorks/42">HVDB社团</a>
      <a href="/Dashboard/TagWorks/7">催眠</a>
      <a href="/Dashboard/CVWorks/9">声优B</a>
    `;

    expect(
      parseHvdbWorkMetadataHtml({
        html,
        id: 123,
        nameToUUID: name => `uuid-${name}`,
      })
    ).to.deep.equal({
      id: 123,
      title: 'HVDB标题',
      nsfw: true,
      circle: {
        id: '42',
        name: 'HVDB社团',
      },
      tags: [
        {
          id: '7',
          name: '催眠',
        },
      ],
      vas: [
        {
          id: 'uuid-声优B',
          name: '声优B',
        },
      ],
    });
  });

  it('marks work as non-nsfw when HVDB SFW is true', () => {
    const html = '<input name="SFW" value="true"><a href="/Dashboard/TagWorks/7">全年龄</a>';

    const metadata = parseHvdbWorkMetadataHtml({
      html,
      id: 123,
      nameToUUID: name => name,
    });

    expect(metadata.nsfw).to.equal(false);
  });
});
