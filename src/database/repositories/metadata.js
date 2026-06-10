const { eq, sql } = require('drizzle-orm');

const { db } = require('../client.js');
const {
  circles,
  tagWorks,
  tags,
  voiceActorWorks,
  voiceActors,
  works,
} = require('../schema/tables.js');

const tableByField = {
  circle: circles,
  tag: tags,
  va: voiceActors,
};

const ratingSelectSql = username => sql`
  SELECT
    t_review.work_id,
    t_review.rating AS userRating,
    t_review.review_text,
    t_review.progress,
    strftime('%Y-%m-%d %H-%M-%S', t_review.updated_at, 'localtime') AS updated_at,
    t_review.user_name
  FROM t_review
  JOIN t_work ON t_work.id = t_review.work_id
  WHERE t_review.user_name = ${username}
`;

const userRatingSelectSql = username => sql`
  SELECT t_review.work_id, t_review.rating
  FROM t_review
  JOIN t_work ON t_work.id = t_review.work_id
  WHERE t_review.user_name = ${username}
`;

const sqlList = values => sql.join(values.map(value => sql`${value}`), sql`, `);

const workRowsWithRatings = (username, whereSql = sql``) => db.all(sql`
  SELECT staticMetadata.*, userrate.rating AS userRating
  FROM staticMetadata
  LEFT JOIN (${userRatingSelectSql(username)}) AS userrate ON userrate.work_id = staticMetadata.id
  ${whereSql}
`);

/**
 * Fetches metadata for a specific work id.
 * @param {Number} id Work identifier.
 * @param {String} username 'admin' or other usernames for current user
 */
const getWorkMetadata = async (id, username) => {
  const work = await db.all(sql`
    SELECT
      staticMetadata.*,
      userrate.userRating,
      userrate.review_text,
      userrate.progress,
      userrate.updated_at,
      userrate.user_name
    FROM staticMetadata
    LEFT JOIN (${ratingSelectSql(username)}) AS userrate ON userrate.work_id = staticMetadata.id
    WHERE id = ${id}
  `);

  if (work.length === 0) throw new Error(`There is no work with id ${id} in the database.`);
  return work;
};

/**
 * Returns list of works by circle, tag or VA.
 * @param {Number[]} id Which id to filter by.
 * @param {String} field Which field to filter by.
 */
const getWorksBy = ({ id, field, username = '' } = {}) => {
  switch (field) {
    case 'circle':
      return workRowsWithRatings(username, sql`WHERE circle_id = ${id[0]}`);

    case 'tag':
      return workRowsWithRatings(
        username,
        sql`
          WHERE id IN (
            SELECT work_id
            FROM r_tag_work
            WHERE tag_id IN (${sqlList(id)})
            GROUP BY work_id
            HAVING COUNT(DISTINCT tag_id) = ${id.length}
          )
        `
      );

    case 'va':
      return workRowsWithRatings(
        username,
        sql`WHERE id IN (SELECT work_id FROM r_va_work WHERE va_id = ${id[0]})`
      );

    default:
      return workRowsWithRatings(username);
  }
};

/**
 * 根据关键字查询音声
 * @param {String} keyword
 */
const getWorksByKeyWord = ({ keyword, username = 'admin' } = {}) => {
  const workid = keyword.match(/((R|r)(J|j))?(\d+)/) ? keyword.match(/((R|r)(J|j))?(\d+)/)[4] : '';
  if (workid) {
    return workRowsWithRatings(username, sql`WHERE id = ${workid}`);
  }

  return workRowsWithRatings(
    username,
    sql`
      WHERE title LIKE ${`%${keyword}%`}
        OR circle_id IN (SELECT id FROM t_circle WHERE name LIKE ${`%${keyword}%`})
        OR id IN (
          SELECT work_id FROM r_tag_work WHERE tag_id IN (SELECT id FROM t_tag WHERE name LIKE ${`%${keyword}%`})
          UNION
          SELECT work_id FROM r_va_work WHERE va_id IN (SELECT id FROM t_va WHERE name LIKE ${`%${keyword}%`})
        )
    `
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
        count: sql`COUNT(${works.circleId})`,
      })
      .from(works)
      .innerJoin(circles, eq(works.circleId, circles.id))
      .groupBy(works.circleId);
  } else if (field === 'tag') {
    return db
      .select({
        id: tags.id,
        name: tags.name,
        count: sql`COUNT(${tagWorks.tagId})`,
      })
      .from(tagWorks)
      .innerJoin(tags, eq(tagWorks.tagId, tags.id))
      .groupBy(tagWorks.tagId);
  } else if (field === 'va') {
    return db
      .select({
        id: voiceActors.id,
        name: voiceActors.name,
        count: sql`COUNT(${voiceActorWorks.vaId})`,
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

module.exports = {
  getLabels,
  getMetadata,
  getWorkMetadata,
  getWorksBy,
  getWorksByKeyWord,
};
