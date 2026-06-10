const { knex } = require('../client.js');

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
  knex.transaction(async trx => {
    //UPSERT
    if (starOnly) {
      await trx.raw(
        'UPDATE t_review SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE user_name = ? AND work_id = ?;',
        [rating, username, workid]
      );
      await trx.raw('INSERT OR IGNORE INTO t_review (user_name, work_id, rating) VALUES (?, ?, ?);', [
        username,
        workid,
        rating,
      ]);
    } else if (progressOnly) {
      await trx.raw(
        'UPDATE t_review SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE user_name = ? AND work_id = ?;',
        [progress, username, workid]
      );
      await trx.raw('INSERT OR IGNORE INTO t_review (user_name, work_id, progress) VALUES (?, ?, ?);', [
        username,
        workid,
        progress,
      ]);
    } else {
      await trx.raw(
        'UPDATE t_review SET rating = ?, review_text = ?, progress = ?, updated_at = CURRENT_TIMESTAMP WHERE user_name = ? AND work_id = ?;',
        [rating, review_text, progress, username, workid]
      );
      await trx.raw(
        'INSERT OR IGNORE INTO t_review (user_name, work_id, rating, review_text, progress) VALUES (?, ?, ?, ?, ?);',
        [username, workid, rating, review_text, progress]
      );
    }
  });

// 删除星标、评语及进度
const deleteUserReview = (username, workid) =>
  knex.transaction(trx => trx('t_review').where('user_name', '=', username).andWhere('work_id', '=', workid).del());

// 读取星标及评语 + 作品元数据
const getWorksWithReviews = async ({
  username = '',
  limit = 1000,
  offset = 0,
  orderBy = 'release',
  sortOption = 'desc',
  filter,
} = {}) => {
  let works;
  let totalCount;

  const ratingSubQuery = knex('t_review')
    .select([
      't_review.work_id',
      't_review.rating AS userRating',
      't_review.review_text',
      't_review.progress',
      knex.raw("strftime('%Y-%m-%d %H-%M-%S', t_review.updated_at, 'localtime') AS updated_at"),
      't_review.user_name',
    ])
    .join('t_work', 't_work.id', 't_review.work_id')
    .where('t_review.user_name', username)
    .as('userrate');

  let query = () =>
    knex('staticMetadata')
      .select([
        'staticMetadata.*',
        'userrate.userRating',
        'userrate.review_text',
        'userrate.progress',
        'userrate.updated_at',
        'userrate.user_name',
      ])
      .join(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id')
      .orderBy(orderBy, sortOption)
      .orderBy([
        { column: 'release', order: 'desc' },
        { column: 'id', order: 'desc' },
      ]);

  if (filter) {
    totalCount = await query().where('progress', '=', filter).count('id as count');
    works = await query().where('progress', '=', filter).limit(limit).offset(offset);
  } else {
    totalCount = await query().count('id as count');
    works = await query().limit(limit).offset(offset);
  }

  return { works, totalCount };
};

module.exports = {
  deleteUserReview,
  getWorksWithReviews,
  updateUserReview,
};
