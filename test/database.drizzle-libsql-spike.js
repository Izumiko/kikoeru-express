/* eslint-disable node/no-unpublished-require */
process.env.FREEZE_CONFIG_FILE = true;
process.env.NODE_ENV = 'test';

const chai = require('chai');
const expect = chai.expect;

const {
  createProbeDatabase,
  readStaticMetadata,
  schema,
} = require('../src/database/spikes/drizzle-libsql/probe');

describe('Drizzle libSQL spike', function () {
  it('can query typed tables through Drizzle libSQL driver', async function () {
    const probe = await createProbeDatabase();

    try {
      const circles = await probe.db.select().from(schema.circles).orderBy(schema.circles.id);

      expect(circles).to.deep.equal([
        { id: 10, name: 'Alpha Circle' },
        { id: 11, name: 'Beta Circle' },
      ]);
    } finally {
      probe.client.close();
    }
  });

  it('can reproduce the staticMetadata view shape with local libSQL', async function () {
    const probe = await createProbeDatabase();

    try {
      const works = await readStaticMetadata(probe.client);

      expect(works.map(work => work.id)).to.deep.equal([100, 101]);
      expect(works[0]).to.include({
        id: 100,
        title: 'Alpha Work',
        circle_id: 10,
        name: 'Alpha Circle',
        nsfw: 0,
        release: '2021-01-02',
        dl_count: 100,
        price: 1100,
        review_count: 3,
        rate_count: 4,
        rate_average_2dp: 4.5,
      });
      expect(JSON.parse(works[0].circleObj)).to.deep.equal({ id: 10, name: 'Alpha Circle' });
      expect(JSON.parse(works[0].tagObj).tags).to.deep.include({ id: 20, name: 'Relax' });
      expect(JSON.parse(works[0].vaObj).vas).to.deep.equal([{ id: 'va-alpha', name: 'Alpha VA' }]);
    } finally {
      probe.client.close();
    }
  });
});
