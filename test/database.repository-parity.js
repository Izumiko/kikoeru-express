process.env.FREEZE_CONFIG_FILE = true;
process.env.NODE_ENV = 'test';

const chai = require('chai');
const expect = chai.expect;

const { libsql } = require('../src/database/client');
const repositories = require('../src/database/repositories');
const { createSchema } = require('../src/database/schema');
const { dropDatabase } = require('./teardown/teardown-0.6.0');

const selectRows = async sql => {
  const result = await libsql.execute(sql);
  return result.rows.map(row => ({ ...row }));
};

const baseWork = values => ({
  id: 100,
  rootFolderName: 'VoiceWork',
  dir: 'RJ000100',
  title: 'Alpha Work',
  circle: { id: 10, name: 'Alpha Circle' },
  nsfw: false,
  release: '2021-01-02',
  dl_count: 100,
  price: 1100,
  review_count: 3,
  rate_count: 4,
  rate_average_2dp: 4.5,
  rate_count_detail: { 5: 3, 4: 1 },
  rank: { daily: 1 },
  tags: [
    { id: 20, name: 'Relax' },
    { id: 21, name: 'Drama' },
  ],
  vas: [{ id: 'va-alpha', name: 'Alpha VA' }],
  ...values,
});

const seedRepositoryFixture = async () => {
  await repositories.createUser({
    name: 'admin',
    password: 'password',
    group: 'administrator',
  });
  await repositories.createUser({
    name: 'listener',
    password: 'password',
    group: 'user',
  });

  await repositories.insertWorkMetadata(baseWork());
  await repositories.insertWorkMetadata(
    baseWork({
      id: 101,
      dir: 'RJ000101',
      title: 'Beta Work',
      circle: { id: 11, name: 'Beta Circle' },
      release: '2021-02-03',
      dl_count: 50,
      price: 770,
      review_count: 1,
      rate_count: 2,
      rate_average_2dp: 3.5,
      rate_count_detail: { 4: 1, 3: 1 },
      rank: null,
      tags: [{ id: 20, name: 'Relax' }],
      vas: [{ id: 'va-beta', name: 'Beta VA' }],
    })
  );

  await repositories.updateUserReview('listener', 100, 5, 'great', 'listened', false, false);
  await repositories.updateUserReview('listener', 101, 4, '', 'listening', true, false);
};

describe('Database repository parity baseline', function () {
  beforeEach(async function () {
    await dropDatabase();
    await createSchema();
    await seedRepositoryFixture();
  });

  afterEach(async function () {
    await dropDatabase();
  });

  it('returns work metadata with staticMetadata JSON fields and user review fields', async function () {
    const works = await repositories.getWorkMetadata(100, 'listener');

    expect(works).to.have.lengthOf(1);
    expect(works[0]).to.include({
      id: 100,
      title: 'Alpha Work',
      circle_id: 10,
      name: 'Alpha Circle',
      userRating: 5,
      review_text: 'great',
      progress: 'listened',
      user_name: 'listener',
    });
    expect(JSON.parse(works[0].circleObj)).to.deep.equal({ id: 10, name: 'Alpha Circle' });
    expect(JSON.parse(works[0].tagObj).tags).to.deep.include({ id: 20, name: 'Relax' });
    expect(JSON.parse(works[0].vaObj).vas).to.deep.equal([{ id: 'va-alpha', name: 'Alpha VA' }]);
  });

  it('filters works by circle, tag intersection, voice actor, keyword, and RJ id', async function () {
    const byCircle = await repositories.getWorksBy({ id: [10], field: 'circle', username: 'listener' });
    const byTag = await repositories.getWorksBy({ id: [20, 21], field: 'tag', username: 'listener' });
    const byVa = await repositories.getWorksBy({ id: ['va-beta'], field: 'va', username: 'listener' });
    const byKeyword = await repositories.getWorksByKeyWord({ keyword: 'Beta', username: 'listener' });
    const byRj = await repositories.getWorksByKeyWord({ keyword: 'RJ000100', username: 'listener' });

    expect(byCircle.map(work => work.id)).to.deep.equal([100]);
    expect(byTag.map(work => work.id)).to.deep.equal([100]);
    expect(byVa.map(work => work.id)).to.deep.equal([101]);
    expect(byKeyword.map(work => work.id)).to.deep.equal([101]);
    expect(byRj.map(work => work.id)).to.deep.equal([100]);
  });

  it('returns labels and metadata in the legacy shapes', async function () {
    const circles = (await repositories.getLabels('circle')).sort((left, right) => left.id - right.id);
    const tags = (await repositories.getLabels('tag')).sort((left, right) => left.id - right.id);
    const vas = (await repositories.getLabels('va')).sort((left, right) => left.id.localeCompare(right.id));
    const metadata = await repositories.getMetadata({ field: 'tag', ids: [20, 21] });

    expect(circles).to.deep.include({ id: 10, name: 'Alpha Circle', count: 1 });
    expect(tags).to.deep.include({ id: 20, name: 'Relax', count: 2 });
    expect(vas).to.deep.include({ id: 'va-alpha', name: 'Alpha VA', count: 1 });
    expect(metadata).to.deep.equal([
      { id: 20, name: 'Relax' },
      { id: 21, name: 'Drama' },
    ]);
  });

  it('updates, filters, and deletes user reviews', async function () {
    await repositories.updateUserReview('listener', 101, 4, '', 'replay', false, true);

    const reviewed = await repositories.getWorksWithReviews({
      username: 'listener',
      orderBy: 'id',
      sortOption: 'asc',
    });
    const replay = await repositories.getWorksWithReviews({
      username: 'listener',
      orderBy: 'id',
      sortOption: 'asc',
      filter: 'replay',
    });

    expect(reviewed.works.map(work => work.id)).to.deep.equal([100, 101]);
    expect(reviewed.totalCount[0].count).to.equal(2);
    expect(replay.works.map(work => work.id)).to.deep.equal([101]);

    await repositories.deleteUserReview('listener', 101);
    const afterDelete = await repositories.getWorksWithReviews({ username: 'listener' });

    expect(afterDelete.works.map(work => work.id)).to.deep.equal([100]);
    expect(afterDelete.totalCount[0].count).to.equal(1);
  });

  it('updates work metadata and removes orphaned metadata when a work is removed', async function () {
    expect(await repositories.getWorkStorageLocation(100)).to.deep.equal({
      root_folder: 'VoiceWork',
      dir: 'RJ000100',
    });
    expect(await repositories.getWorkTrackMetadata(100)).to.deep.equal({
      title: 'Alpha Work',
      root_folder: 'VoiceWork',
      dir: 'RJ000100',
    });
    expect(await repositories.workExists(100)).to.equal(true);
    expect(await repositories.workExists(999999)).to.equal(false);
    expect(await repositories.listWorkStorageLocations()).to.deep.include({
      id: 100,
      root_folder: 'VoiceWork',
      dir: 'RJ000100',
    });
    expect(await repositories.listWorkIds()).to.deep.include({ id: 100 });
    expect(await repositories.listWorkIdsByVoiceActorIds(['va-alpha'])).to.deep.equal([{ work_id: 100 }]);

    await repositories.updateWorkMetadata(
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

    const updated = await repositories.getWorkMetadata(100, 'listener');
    expect(updated[0]).to.include({
      id: 100,
      title: 'Alpha Work Updated',
      nsfw: 1,
      dl_count: 200,
      price: 1200,
    });
    expect(JSON.parse(updated[0].tagObj).tags).to.deep.equal([{ id: 22, name: 'New Tag' }]);
    expect(JSON.parse(updated[0].vaObj).vas).to.deep.equal([{ id: 'va-new', name: 'New VA' }]);

    await repositories.removeWork(100);

    expect(await selectRows('SELECT * FROM t_work WHERE id = 100')).to.deep.equal([]);
    expect(await selectRows('SELECT * FROM t_circle WHERE id = 10')).to.deep.equal([]);
    expect(await selectRows('SELECT * FROM t_tag WHERE id = 22')).to.deep.equal([]);
    expect(await selectRows("SELECT * FROM t_va WHERE id = 'va-new'")).to.deep.equal([]);
  });

  it('keeps user repository behavior stable', async function () {
    await repositories.createUser({ name: 'temporary', password: 'old', group: 'user' });
    expect(await repositories.getUserByName('temporary')).to.include({
      name: 'temporary',
      password: 'old',
      group: 'user',
    });
    expect(await repositories.getUsers()).to.deep.include({ name: 'temporary', group: 'user' });

    await repositories.updateUserPassword({ name: 'temporary' }, 'new');
    expect(await repositories.getUserByName('temporary')).to.include({ password: 'new' });

    await repositories.resetUserPassword({ name: 'temporary' });
    expect(await repositories.getUserByName('temporary')).to.include({ password: 'password' });

    await repositories.deleteUser([{ name: 'temporary' }]);
    expect(await repositories.getUserByName('temporary')).to.equal(undefined);
  });
});
