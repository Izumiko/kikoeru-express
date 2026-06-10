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
const { createReviewRepository } = require('../src/database/spikes/drizzle-libsql/review-repository');
const { createUserRepository } = require('../src/database/spikes/drizzle-libsql/user-repository');
const { createWorkRepository } = require('../src/database/spikes/drizzle-libsql/work-repository');

const baseWork = values => ({
  id: 200,
  rootFolderName: 'VoiceWork',
  dir: 'RJ000200',
  title: 'Gamma Work',
  circle: { id: 12, name: 'Gamma Circle' },
  nsfw: false,
  release: '2021-03-04',
  dl_count: 25,
  price: 550,
  review_count: 1,
  rate_count: 2,
  rate_average_2dp: 4,
  rate_count_detail: { 5: 1, 3: 1 },
  rank: { monthly: 7 },
  tags: [{ id: 30, name: 'Inserted Tag' }],
  vas: [{ id: 'va-gamma', name: 'Gamma VA' }],
  ...values,
});

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

  it('matches the Knex work metadata write behavior', async function () {
    const probe = await createProbeDatabase();
    const metadataRepository = createMetadataRepository(probe.client);
    const workRepository = createWorkRepository(probe.client);

    try {
      await workRepository.insertWorkMetadata(baseWork());

      const inserted = await metadataRepository.getWorkMetadata(200, 'listener');
      expect(inserted[0]).to.include({
        id: 200,
        title: 'Gamma Work',
        circle_id: 12,
        name: 'Gamma Circle',
        nsfw: 0,
        dl_count: 25,
        price: 550,
      });
      expect(JSON.parse(inserted[0].tagObj).tags).to.deep.equal([{ id: 30, name: 'Inserted Tag' }]);
      expect(JSON.parse(inserted[0].vaObj).vas).to.deep.equal([{ id: 'va-gamma', name: 'Gamma VA' }]);

      await workRepository.updateWorkMetadata(
        baseWork({
          id: 100,
          title: 'Alpha Work Updated',
          nsfw: true,
          dl_count: 200,
          price: 1200,
          review_count: 5,
          rate_count: 6,
          rate_average_2dp: 4.8,
          rate_count_detail: { 5: 6 },
          rank: { weekly: 2 },
          tags: [{ id: 22, name: 'New Tag' }],
          vas: [{ id: 'va-new', name: 'New VA' }],
        }),
        {
          refreshAll: true,
          purgeTags: true,
        }
      );

      const updated = await metadataRepository.getWorkMetadata(100, 'listener');
      expect(updated[0]).to.include({
        id: 100,
        title: 'Alpha Work Updated',
        nsfw: 1,
        dl_count: 200,
        price: 1200,
      });
      expect(JSON.parse(updated[0].tagObj).tags).to.deep.equal([{ id: 22, name: 'New Tag' }]);
      expect(JSON.parse(updated[0].vaObj).vas).to.deep.equal([{ id: 'va-new', name: 'New VA' }]);

      await workRepository.removeWork(100);

      const removedWork = await probe.client.execute({
        sql: 'SELECT * FROM t_work WHERE id = ?',
        args: [100],
      });
      const orphanCircle = await probe.client.execute({
        sql: 'SELECT * FROM t_circle WHERE id = ?',
        args: [10],
      });
      const orphanTag = await probe.client.execute({
        sql: 'SELECT * FROM t_tag WHERE id = ?',
        args: [22],
      });
      const orphanVa = await probe.client.execute({
        sql: 'SELECT * FROM t_va WHERE id = ?',
        args: ['va-new'],
      });

      expect(removedWork.rows).to.deep.equal([]);
      expect(orphanCircle.rows).to.deep.equal([]);
      expect(orphanTag.rows).to.deep.equal([]);
      expect(orphanVa.rows).to.deep.equal([]);
    } finally {
      probe.client.close();
    }
  });

  it('matches the Knex review repository behavior', async function () {
    const probe = await createProbeDatabase();
    const reviewRepository = createReviewRepository(probe.client);

    try {
      await reviewRepository.updateUserReview('listener', 101, 4, '', 'replay', false, true);

      const reviewed = await reviewRepository.getWorksWithReviews({
        username: 'listener',
        orderBy: 'id',
        sortOption: 'asc',
      });
      const replay = await reviewRepository.getWorksWithReviews({
        username: 'listener',
        orderBy: 'id',
        sortOption: 'asc',
        filter: 'replay',
      });

      expect(reviewed.works.map(work => work.id)).to.deep.equal([100, 101]);
      expect(reviewed.totalCount[0].count).to.equal(2);
      expect(replay.works.map(work => work.id)).to.deep.equal([101]);

      await reviewRepository.deleteUserReview('listener', 101);
      const afterDelete = await reviewRepository.getWorksWithReviews({ username: 'listener' });

      expect(afterDelete.works.map(work => work.id)).to.deep.equal([100]);
      expect(afterDelete.totalCount[0].count).to.equal(1);
    } finally {
      probe.client.close();
    }
  });

  it('matches the Knex user repository behavior', async function () {
    const probe = await createProbeDatabase();
    const userRepository = createUserRepository(probe.client);

    try {
      await userRepository.createUser({ name: 'temporary', password: 'old', group: 'user' });
      await userRepository.updateUserPassword({ name: 'temporary' }, 'new');

      const updated = await probe.client.execute({
        sql: 'SELECT * FROM t_user WHERE name = ?',
        args: ['temporary'],
      });
      expect(updated.rows[0]).to.include({ password: 'new' });

      await userRepository.resetUserPassword({ name: 'temporary' });
      const reset = await probe.client.execute({
        sql: 'SELECT * FROM t_user WHERE name = ?',
        args: ['temporary'],
      });
      expect(reset.rows[0]).to.include({ password: 'password' });

      await userRepository.deleteUser([{ name: 'temporary' }]);
      const deleted = await probe.client.execute({
        sql: 'SELECT * FROM t_user WHERE name = ?',
        args: ['temporary'],
      });
      expect(deleted.rows).to.deep.equal([]);
    } finally {
      probe.client.close();
    }
  });
});
