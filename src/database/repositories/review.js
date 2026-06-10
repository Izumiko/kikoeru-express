const { and, eq, sql } = require('drizzle-orm');

const { db } = require('../client.js');
const { reviews } = require('../schema/tables.js');

const reviewKey = (username, workid) =>
  and(eq(reviews.userName, username), eq(reviews.workId, String(workid)));

const reviewValues = (username, workid, values = {}) => ({
  userName: username,
  workId: String(workid),
  ...values,
});

const orderColumns = new Set([
  'id',
  'title',
  'circle_id',
  'name',
  'nsfw',
  'release',
  'dl_count',
  'price',
  'review_count',
  'rate_count',
  'rate_average_2dp',
]);

const normalizeOrderBy = orderBy => (orderColumns.has(orderBy) ? orderBy : 'release');
const normalizeSortOption = sortOption => (sortOption === 'asc' ? 'asc' : 'desc');

// 添加星标或评语或进度
const updateUserReview = async (
  username,
  workid,
  rating,
  review_text = '',
  progress = '',
  starOnly = true,
  progressOnly = false
) =>
  db.transaction(async tx => {
    if (starOnly) {
      await tx
        .update(reviews)
        .set({ rating, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(reviewKey(username, workid));
      await tx.insert(reviews).values(reviewValues(username, workid, { rating })).onConflictDoNothing();
    } else if (progressOnly) {
      await tx
        .update(reviews)
        .set({ progress, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(reviewKey(username, workid));
      await tx.insert(reviews).values(reviewValues(username, workid, { progress })).onConflictDoNothing();
    } else {
      await tx
        .update(reviews)
        .set({ rating, reviewText: review_text, progress, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(reviewKey(username, workid));
      await tx
        .insert(reviews)
        .values(reviewValues(username, workid, { rating, reviewText: review_text, progress }))
        .onConflictDoNothing();
    }
  });

// 删除星标、评语及进度
const deleteUserReview = (username, workid) =>
  db.transaction(tx => tx.delete(reviews).where(reviewKey(username, workid)));

// 读取星标及评语 + 作品元数据
const getWorksWithReviews = async ({
  username = '',
  limit = 1000,
  offset = 0,
  orderBy = 'release',
  sortOption = 'desc',
  filter,
} = {}) => {
  const filterSql = filter ? sql`WHERE progress = ${filter}` : sql``;
  const orderBySql = sql.raw(normalizeOrderBy(orderBy));
  const sortOptionSql = sql.raw(normalizeSortOption(sortOption));

  const works = await db.all(sql`
    SELECT
      staticMetadata.*,
      userrate.userRating,
      userrate.review_text,
      userrate.progress,
      userrate.updated_at,
      userrate.user_name
    FROM staticMetadata
    JOIN (
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
    ) AS userrate ON userrate.work_id = staticMetadata.id
    ${filterSql}
    ORDER BY ${orderBySql} ${sortOptionSql}, release DESC, id DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
  const totalCount = await db.all(sql`
    SELECT COUNT(id) AS count
    FROM staticMetadata
    JOIN (
      SELECT t_review.work_id, t_review.progress
      FROM t_review
      JOIN t_work ON t_work.id = t_review.work_id
      WHERE t_review.user_name = ${username}
    ) AS userrate ON userrate.work_id = staticMetadata.id
    ${filterSql}
  `);

  return { works, totalCount };
};

module.exports = {
  deleteUserReview,
  getWorksWithReviews,
  updateUserReview,
};
