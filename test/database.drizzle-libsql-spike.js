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
const { createMetadataRepository } = require('../src/database/spikes/drizzle-libsql/metadata-repository');

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

  it('matches the Knex metadata repository read behavior', async function () {
    const probe = await createProbeDatabase();
    const repository = createMetadataRepository(probe.client);

    try {
      const workMetadata = await repository.getWorkMetadata(100, 'listener');
      const byCircle = await repository.getWorksBy({ id: [10], field: 'circle', username: 'listener' });
      const byTag = await repository.getWorksBy({ id: [20, 21], field: 'tag', username: 'listener' });
      const byVa = await repository.getWorksBy({ id: ['va-beta'], field: 'va', username: 'listener' });
      const byKeyword = await repository.getWorksByKeyWord({ keyword: 'Beta', username: 'listener' });
      const byRj = await repository.getWorksByKeyWord({ keyword: 'RJ000100', username: 'listener' });
      const circles = (await repository.getLabels('circle')).sort((left, right) => left.id - right.id);
      const tags = (await repository.getLabels('tag')).sort((left, right) => left.id - right.id);
      const vas = (await repository.getLabels('va')).sort((left, right) => left.id.localeCompare(right.id));
      const metadata = await repository.getMetadata({ field: 'tag', ids: [20, 21] });

      expect(workMetadata).to.have.lengthOf(1);
      expect(workMetadata[0]).to.include({
        id: 100,
        title: 'Alpha Work',
        circle_id: 10,
        name: 'Alpha Circle',
        userRating: 5,
        review_text: 'great',
        progress: 'listened',
        user_name: 'listener',
      });
      expect(byCircle.map(work => work.id)).to.deep.equal([100]);
      expect(byTag.map(work => work.id)).to.deep.equal([100]);
      expect(byVa.map(work => work.id)).to.deep.equal([101]);
      expect(byKeyword.map(work => work.id)).to.deep.equal([101]);
      expect(byRj.map(work => work.id)).to.deep.equal([100]);
      expect(circles).to.deep.include({ id: 10, name: 'Alpha Circle', count: 1 });
      expect(tags).to.deep.include({ id: 20, name: 'Relax', count: 2 });
      expect(vas).to.deep.include({ id: 'va-alpha', name: 'Alpha VA', count: 1 });
      expect(metadata).to.deep.equal([
        { id: 20, name: 'Relax' },
        { id: 21, name: 'Drama' },
      ]);
    } finally {
      probe.client.close();
    }
  });
});
