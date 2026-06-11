import { and, asc, count, desc, eq, sql } from 'drizzle-orm';

import { db } from '../client.js';
import { reviews, staticMetadata } from '../schema/tables.js';
import { workWithUserReviewFields } from './static-metadata-select.js';

type ReviewValues = {
  rating?: number;
  reviewText?: string;
  progress?: string;
};

const reviewKey = (username: string, workid: number | string) =>
  and(eq(reviews.userName, username), eq(reviews.workId, String(workid)));

const reviewValues = (username: string, workid: number | string, values: ReviewValues = {}) => ({
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

type ReviewSortOption = 'asc' | 'desc';

type OrderColumnMap = typeof orderColumnByName;

type GetWorksWithReviewsOptions = {
  username?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  sortOption?: string;
  filter?: string;
};

const normalizeOrderBy = (orderBy: string) =>
  orderColumnByName[(orderColumns.has(orderBy) ? orderBy : 'release') as keyof OrderColumnMap];
const normalizeSortOption = (sortOption: string): ReviewSortOption => (sortOption === 'asc' ? 'asc' : 'desc');
const sortExpression = (column: Parameters<typeof asc>[0], sortOption: string) =>
  normalizeSortOption(sortOption) === 'asc' ? asc(column) : desc(column);

// 添加星标或评语或进度
const updateUserReview = async (
  username: string,
  workid: number | string,
  rating: number,
  review_text = '',
  progress = '',
  starOnly = true,
  progressOnly = false
) =>
  db.transaction(async (tx) => {
    if (starOnly) {
      await tx
        .update(reviews)
        .set({ rating, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(reviewKey(username, workid));
      await tx
        .insert(reviews)
        .values(reviewValues(username, workid, { rating }))
        .onConflictDoNothing();
    } else if (progressOnly) {
      await tx
        .update(reviews)
        .set({ progress, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(reviewKey(username, workid));
      await tx
        .insert(reviews)
        .values(reviewValues(username, workid, { progress }))
        .onConflictDoNothing();
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
const deleteUserReview = (username: string, workid: number | string) =>
  db.transaction((tx) => tx.delete(reviews).where(reviewKey(username, workid)));

// 读取星标及评语 + 作品元数据
const getWorksWithReviews = async ({
  username = '',
  limit = 1000,
  offset = 0,
  orderBy = 'release',
  sortOption = 'desc',
  filter,
}: GetWorksWithReviewsOptions = {}) => {
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

export { deleteUserReview, getWorksWithReviews, updateUserReview };
