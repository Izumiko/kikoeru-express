const { eq, sql } = require('drizzle-orm');

const { db } = require('../libsql-client.js');
const {
  circles,
  reviews,
  tagWorks,
  tags,
  voiceActorWorks,
  voiceActors,
  works,
} = require('../schema/tables.js');

const toWorkRow = work => ({
  id: work.id,
  rootFolder: work.rootFolderName,
  dir: work.dir,
  title: work.title,
  circleId: work.circle.id,
  nsfw: work.nsfw,
  release: work.release,
  dlCount: work.dl_count,
  price: work.price,
  reviewCount: work.review_count,
  rateCount: work.rate_count,
  rateAverage2dp: work.rate_average_2dp,
  rateCountDetail: JSON.stringify(work.rate_count_detail),
  rank: work.rank ? JSON.stringify(work.rank) : null,
});

const toDynamicWorkRow = work => ({
  dlCount: work.dl_count,
  price: work.price,
  reviewCount: work.review_count,
  rateCount: work.rate_count,
  rateAverage2dp: work.rate_average_2dp,
  rateCountDetail: JSON.stringify(work.rate_count_detail),
  rank: work.rank ? JSON.stringify(work.rank) : null,
});

const insertWorkRelationships = async (tx, work, options = {}) => {
  if (options.includeTags) {
    if (options.purgeTags) {
      await tx.delete(tagWorks).where(eq(tagWorks.workId, work.id));
    }

    for (const tag of work.tags) {
      await tx.insert(tags).values({ id: tag.id, name: tag.name }).onConflictDoNothing();
      await tx.insert(tagWorks).values({ tagId: tag.id, workId: work.id }).onConflictDoNothing();
    }
  }

  if (options.includeVA) {
    if (options.replaceVA) {
      await tx.delete(voiceActorWorks).where(eq(voiceActorWorks.workId, work.id));
    }

    for (const va of work.vas) {
      await tx.insert(voiceActors).values({ id: va.id, name: va.name }).onConflictDoNothing();
      await tx.insert(voiceActorWorks).values({ vaId: va.id, workId: work.id }).onConflictDoNothing();
    }
  }
};

/**
 * Takes a work metadata object and inserts it into the database.
 * @param {Object} work Work object.
 */
const insertWorkMetadata = work =>
  db.transaction(async tx => {
    await tx.insert(circles).values({ id: work.circle.id, name: work.circle.name }).onConflictDoNothing();
    await tx.insert(works).values(toWorkRow(work));
    await insertWorkRelationships(tx, work, {
      includeTags: true,
      includeVA: true,
    });
  });

/**
 * 更新音声的动态元数据
 * @param {Object} work Work object.
 */
const updateWorkMetadata = (work, options = {}) =>
  db.transaction(async tx => {
    await tx.update(works).set(toDynamicWorkRow(work)).where(eq(works.id, work.id));

    await insertWorkRelationships(tx, work, {
      includeTags: options.includeTags || options.refreshAll,
      includeVA: options.includeVA || options.refreshAll,
      purgeTags: options.purgeTags,
      replaceVA: options.includeVA || options.refreshAll,
    });

    // Fix a bug caused by DLsite changes.
    if (options.includeNSFW) {
      await tx.update(works).set({ nsfw: work.nsfw }).where(eq(works.id, work.id));
    }

    if (options.refreshAll) {
      await tx
        .update(works)
        .set({ nsfw: work.nsfw, title: work.title, release: work.release })
        .where(eq(works.id, work.id));
    }
  });

const countRows = async (tx, table, where) => {
  const rows = await tx.select({ count: sql`COUNT(*)` }).from(table).where(where);
  return rows[0].count;
};

const cleanupOrphans = async (tx, circleId, tagIds, vaIds) => {
  if ((await countRows(tx, works, eq(works.circleId, circleId))) === 0) {
    await tx.delete(circles).where(eq(circles.id, circleId));
  }

  for (const tagId of tagIds) {
    if ((await countRows(tx, tagWorks, eq(tagWorks.tagId, tagId))) === 0) {
      await tx.delete(tags).where(eq(tags.id, tagId));
    }
  }

  for (const vaId of vaIds) {
    if ((await countRows(tx, voiceActorWorks, eq(voiceActorWorks.vaId, vaId))) === 0) {
      await tx.delete(voiceActors).where(eq(voiceActors.id, vaId));
    }
  }
};

/**
 * Removes a work and then its orphaned circles, tags & VAs from the database.
 * @param {Integer} id Work id.
 */
const removeWork = id =>
  db.transaction(async tx => {
    const [work] = await tx.select({ circleId: works.circleId }).from(works).where(eq(works.id, id)).limit(1);
    if (!work) return;

    const workTags = await tx.select({ tagId: tagWorks.tagId }).from(tagWorks).where(eq(tagWorks.workId, id));
    const workVas = await tx
      .select({ vaId: voiceActorWorks.vaId })
      .from(voiceActorWorks)
      .where(eq(voiceActorWorks.workId, id));

    await tx.delete(tagWorks).where(eq(tagWorks.workId, id));
    await tx.delete(voiceActorWorks).where(eq(voiceActorWorks.workId, id));
    await tx.delete(reviews).where(eq(reviews.workId, String(id)));
    await tx.delete(works).where(eq(works.id, id));
    await cleanupOrphans(
      tx,
      work.circleId,
      workTags.map(tag => tag.tagId),
      workVas.map(va => va.vaId)
    );
  });

/**
 * 获取音声文件在本地根目录下的存储位置
 * @param {Integer} id Work id.
 */
const getWorkStorageLocation = async id => {
  const result = await db
    .select({
      root_folder: works.rootFolder,
      dir: works.dir,
    })
    .from(works)
    .where(eq(works.id, id))
    .limit(1);

  return result[0];
};

/**
 * 获取音声曲目列表需要的基础元数据
 * @param {Integer} id Work id.
 */
const getWorkTrackMetadata = async id => {
  const result = await db
    .select({
      title: works.title,
      root_folder: works.rootFolder,
      dir: works.dir,
    })
    .from(works)
    .where(eq(works.id, id))
    .limit(1);

  return result[0];
};

/**
 * 检查指定作品是否已存在
 * @param {Integer} id Work id.
 */
const workExists = async id => {
  const result = await db.select({ id: works.id }).from(works).where(eq(works.id, id)).limit(1);
  return Boolean(result[0]);
};

/**
 * 列出所有作品的本地存储位置，用于扫描前清理缺失文件夹。
 */
const listWorkStorageLocations = () =>
  db
    .select({
      id: works.id,
      root_folder: works.rootFolder,
      dir: works.dir,
    })
    .from(works);

module.exports = {
  getWorkStorageLocation,
  getWorkTrackMetadata,
  insertWorkMetadata,
  listWorkStorageLocations,
  removeWork,
  updateWorkMetadata,
  workExists,
};
