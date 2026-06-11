import { eq, inArray, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { db } from '../client.js';
import { circles, reviews, tagWorks, tags, voiceActorWorks, voiceActors, works } from '../schema/tables.js';

type WorkRelationship = {
  id: number | string;
  name: string;
};

type WorkMetadata = {
  id: number;
  rootFolderName: string;
  dir: string;
  title: string;
  circle: {
    id: number;
    name: string;
  };
  nsfw?: boolean | null;
  release?: string | null;
  dl_count?: number | null;
  price?: number | null;
  review_count?: number | null;
  rate_count?: number | null;
  rate_average_2dp?: number | null;
  rate_count_detail?: unknown;
  rank?: unknown;
  tags: Array<WorkRelationship & { id: number }>;
  vas: Array<WorkRelationship & { id: string }>;
};

type WorkRelationshipOptions = {
  includeTags?: boolean;
  purgeTags?: boolean;
  includeVA?: boolean;
  replaceVA?: boolean;
  refreshAll?: boolean;
};

type UpdateWorkMetadataOptions = WorkRelationshipOptions & {
  includeNSFW?: boolean;
};

const toWorkRow = (work: WorkMetadata) => ({
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

const toDynamicWorkRow = (work: WorkMetadata) => ({
  dlCount: work.dl_count,
  price: work.price,
  reviewCount: work.review_count,
  rateCount: work.rate_count,
  rateAverage2dp: work.rate_average_2dp,
  rateCountDetail: JSON.stringify(work.rate_count_detail),
  rank: work.rank ? JSON.stringify(work.rank) : null,
});

type TransactionType = Parameters<Parameters<typeof db.transaction>[0]>[0];

const insertWorkRelationships = async (
  tx: TransactionType,
  work: WorkMetadata,
  options: WorkRelationshipOptions = {}
) => {
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
const insertWorkMetadata = (work: WorkMetadata) =>
  db.transaction(async (tx) => {
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
const updateWorkMetadata = (work: WorkMetadata, options: UpdateWorkMetadataOptions = {}) =>
  db.transaction(async (tx) => {
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

const countRows = async (tx: TransactionType, table: SQLiteTable, where: SQL | undefined) => {
  const rows = await tx
    .select({ count: sql`COUNT(*)` })
    .from(table)
    .where(where);
  return rows[0].count;
};

const cleanupOrphans = async (tx: TransactionType, circleId: number, tagIds: number[], vaIds: string[]) => {
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
const removeWork = (id: number) =>
  db.transaction(async (tx) => {
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
      workTags.map((tag) => tag.tagId).filter((id): id is number => id !== null),
      workVas.map((va) => va.vaId).filter((id): id is string => id !== null)
    );
  });

/**
 * 获取音声文件在本地根目录下的存储位置
 * @param {Integer} id Work id.
 */
const getWorkStorageLocation = async (id: number) => {
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
const getWorkTrackMetadata = async (id: number) => {
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
const workExists = async (id: number) => {
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

/**
 * 列出所有作品 id，用于更新扫描。
 */
const listWorkIds = () => db.select({ id: works.id }).from(works);

/**
 * 列出指定声优关联的作品 id，用于修复旧版声优 UUID 碰撞。
 * @param {String[]} voiceActorIds Voice actor ids.
 */
const listWorkIdsByVoiceActorIds = (voiceActorIds: string[]) =>
  db
    .select({
      work_id: voiceActorWorks.workId,
    })
    .from(voiceActorWorks)
    .where(inArray(voiceActorWorks.vaId, voiceActorIds));

export {
  getWorkStorageLocation,
  getWorkTrackMetadata,
  insertWorkMetadata,
  listWorkIds,
  listWorkIdsByVoiceActorIds,
  listWorkStorageLocations,
  removeWork,
  updateWorkMetadata,
  workExists,
};
export type { UpdateWorkMetadataOptions, WorkMetadata, WorkRelationship, WorkRelationshipOptions };
