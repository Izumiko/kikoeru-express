import { sql } from 'drizzle-orm';

import { reviews, staticMetadata } from '../schema/tables.js';

const staticMetadataFields = {
  id: staticMetadata.id,
  title: staticMetadata.title,
  circle_id: staticMetadata.circleId,
  name: staticMetadata.name,
  circleObj: staticMetadata.circleObj,
  nsfw: sql<number>`CAST(${staticMetadata.nsfw} AS INTEGER)`,
  release: staticMetadata.release,
  dl_count: staticMetadata.dlCount,
  price: staticMetadata.price,
  review_count: staticMetadata.reviewCount,
  rate_count: staticMetadata.rateCount,
  rate_average_2dp: staticMetadata.rateAverage2dp,
  rate_count_detail: staticMetadata.rateCountDetail,
  rank: staticMetadata.rank,
  insertTime: staticMetadata.insertTime,
  vaObj: staticMetadata.vaObj,
  tagObj: staticMetadata.tagObj,
};

const userReviewFields = {
  userRating: reviews.rating,
  review_text: reviews.reviewText,
  progress: reviews.progress,
  updated_at: sql<string>`strftime('%Y-%m-%d %H-%M-%S', ${reviews.updatedAt}, 'localtime')`,
  user_name: reviews.userName,
};

const workWithUserReviewFields = {
  ...staticMetadataFields,
  ...userReviewFields,
};

export { staticMetadataFields, userReviewFields, workWithUserReviewFields };
