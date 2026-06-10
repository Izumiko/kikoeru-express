const { and, asc, count, desc, eq, sql } = require('drizzle-orm');

const { db } = require('../client.js');
const { reviews, staticMetadata } = require('../schema/tables.js');
const { workWithUserReviewFields } = require('./static-metadata-select.js');

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

const orderColumnByName = {
  id: staticMetadata.id,
  title: staticMetadata.title,
  circle_id: staticMetadata.circleId,
  name: staticMetadata.name,
  nsfw: staticMetadata.nsfw,
  release: staticMetadata.release,
  dl_count: staticMetadata.dlCount,
  price: staticMetadata.price,
  review_count: staticMetadata.reviewCount,
  rate_count: staticMetadata.rateCount,
  rate_average_2dp: staticMetadata.rateAverage2dp,
};

const normalizeOrderBy = orderBy => orderColumnByName[orderColumns.has(orderBy) ? orderBy : 'release'];
const normalizeSortOption = sortOption => (sortOption === 'asc' ? 'asc' : 'desc');
const sortExpression = (column, sortOption) => (normalizeSortOption(sortOption) === 'asc' ? asc(column) : desc(column));

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
  const reviewWhere = filter
    ? and(eq(reviews.userName, username), eq(reviews.progress, filter))
    : eq(reviews.userName, username);
  const orderByColumn = normalizeOrderBy(orderBy);

  const works = await db
    .select(workWithUserReviewFields)
    .from(staticMetadata)
    .innerJoin(reviews, eq(reviews.workId, staticMetadata.id))
    .where(reviewWhere)
    .orderBy(sortExpression(orderByColumn, sortOption), desc(staticMetadata.release), desc(staticMetadata.id))
    .limit(limit)
    .offset(offset);

  const totalCount = await db
    .select({ count: count(staticMetadata.id) })
    .from(staticMetadata)
    .innerJoin(reviews, eq(reviews.workId, staticMetadata.id))
    .where(reviewWhere);

  return { works, totalCount };
};

module.exports = {
  deleteUserReview,
  getWorksWithReviews,
  updateUserReview,
};
