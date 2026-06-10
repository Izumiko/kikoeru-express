// @ts-nocheck
import { and, count, countDistinct, eq, inArray, like, or, sql } from 'drizzle-orm';

import { db } from '../client.js';
import {
  circles,
  reviews,
  staticMetadata,
  tagWorks,
  tags,
  voiceActorWorks,
  voiceActors,
  works,
} from '../schema/tables.js';
import { staticMetadataFields, workWithUserReviewFields } from './static-metadata-select.js';

const tableByField = {
  circle: circles,
  tag: tags,
  va: voiceActors,
};

const reviewJoinKey = username =>
  and(eq(reviews.workId, staticMetadata.id), eq(reviews.userName, username));

const workRowsWithRatings = (username, where) => {
  let query = db
    .select({
      ...staticMetadataFields,
      userRating: reviews.rating,
    })
    .from(staticMetadata)
    .leftJoin(reviews, reviewJoinKey(username));

  if (where) {
    query = query.where(where);
  }

  return query;
};

const getWorkIdsForAllTags = async tagIds => {
  const rows = await db
    .select({ workId: tagWorks.workId })
    .from(tagWorks)
    .where(inArray(tagWorks.tagId, tagIds))
    .groupBy(tagWorks.workId)
    .having(eq(countDistinct(tagWorks.tagId), tagIds.length));

  return rows.map(row => row.workId);
};

const getWorkIdsByVoiceActor = async voiceActorId => {
  const rows = await db
    .select({ workId: voiceActorWorks.workId })
    .from(voiceActorWorks)
    .where(eq(voiceActorWorks.vaId, voiceActorId));

  return rows.map(row => row.workId);
};

const inArrayOrNoMatch = (column, values) => (values.length ? inArray(column, values) : sql`0 = 1`);

/**
 * Fetches metadata for a specific work id.
 * @param {Number} id Work identifier.
 * @param {String} username 'admin' or other usernames for current user
 */
const getWorkMetadata = async (id, username) => {
  const work = await db
    .select(workWithUserReviewFields)
    .from(staticMetadata)
    .leftJoin(reviews, reviewJoinKey(username))
    .where(eq(staticMetadata.id, id));

  if (work.length === 0) throw new Error(`There is no work with id ${id} in the database.`);
  return work;
};

/**
 * Returns list of works by circle, tag or VA.
 * @param {Number[]} id Which id to filter by.
 * @param {String} field Which field to filter by.
 */
const getWorksBy = async ({ id, field, username = '' } = {}) => {
  switch (field) {
    case 'circle':
      return workRowsWithRatings(username, eq(staticMetadata.circleId, id[0]));

    case 'tag':
      return workRowsWithRatings(username, inArrayOrNoMatch(staticMetadata.id, await getWorkIdsForAllTags(id)));

    case 'va':
      return workRowsWithRatings(username, inArrayOrNoMatch(staticMetadata.id, await getWorkIdsByVoiceActor(id[0])));

    default:
      return workRowsWithRatings(username);
  }
};

const getWorkIdsByMatchingTags = async keyword => {
  const rows = await db
    .select({ workId: tagWorks.workId })
    .from(tagWorks)
    .innerJoin(tags, eq(tagWorks.tagId, tags.id))
    .where(like(tags.name, `%${keyword}%`));

  return rows.map(row => row.workId);
};

const getWorkIdsByMatchingVoiceActors = async keyword => {
  const rows = await db
    .select({ workId: voiceActorWorks.workId })
    .from(voiceActorWorks)
    .innerJoin(voiceActors, eq(voiceActorWorks.vaId, voiceActors.id))
    .where(like(voiceActors.name, `%${keyword}%`));

  return rows.map(row => row.workId);
};

/**
 * 根据关键字查询音声
 * @param {String} keyword
 */
const getWorksByKeyWord = async ({ keyword, username = 'admin' } = {}) => {
  const workid = keyword.match(/((R|r)(J|j))?(\d+)/) ? keyword.match(/((R|r)(J|j))?(\d+)/)[4] : '';
  if (workid) {
    return workRowsWithRatings(username, eq(staticMetadata.id, Number(workid)));
  }

  const tagWorkIds = await getWorkIdsByMatchingTags(keyword);
  const voiceActorWorkIds = await getWorkIdsByMatchingVoiceActors(keyword);

  return workRowsWithRatings(
    username,
    or(
      like(staticMetadata.title, `%${keyword}%`),
      like(staticMetadata.name, `%${keyword}%`),
      inArrayOrNoMatch(staticMetadata.id, [...new Set([...tagWorkIds, ...voiceActorWorkIds])])
    )
  );
};

/**
 * 获取所有社团/标签/声优的元数据列表
 * @param {Starting} field ['circle', 'tag', 'va'] 中的一个
 */
const getLabels = field => {
  if (field === 'circle') {
    return db
      .select({
        id: circles.id,
        name: circles.name,
        count: count(works.circleId),
      })
      .from(works)
      .innerJoin(circles, eq(works.circleId, circles.id))
      .groupBy(works.circleId);
  } else if (field === 'tag') {
    return db
      .select({
        id: tags.id,
        name: tags.name,
        count: count(tagWorks.tagId),
      })
      .from(tagWorks)
      .innerJoin(tags, eq(tagWorks.tagId, tags.id))
      .groupBy(tagWorks.tagId);
  } else if (field === 'va') {
    return db
      .select({
        id: voiceActors.id,
        name: voiceActors.name,
        count: count(voiceActorWorks.vaId),
      })
      .from(voiceActorWorks)
      .innerJoin(voiceActors, eq(voiceActorWorks.vaId, voiceActors.id))
      .groupBy(voiceActorWorks.vaId);
  }
  return undefined;
};

/**
 * 获取元数据
 * @param {{
 *  field: string,
 *  id: number[]
 * }} param0
 * @returns
 */
const getMetadata = ({ field = 'circle', ids } = {}) => {
  const validFields = ['circle', 'tag', 'va'];
  if (!validFields.includes(field)) throw new Error('无效的查询域');

  const table = tableByField[field];
  return Promise.all(
    ids.map(async id => {
      const rows = await db.select().from(table).where(eq(table.id, id)).limit(1);
      return rows[0];
    })
  );
};

export {
  getLabels,
  getMetadata,
  getWorkMetadata,
  getWorksBy,
  getWorksByKeyWord,
};
