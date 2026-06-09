const { knex } = require('../client.js');

/**
 * Fetches metadata for a specific work id.
 * @param {Number} id Work identifier.
 * @param {String} username 'admin' or other usernames for current user
 */
const getWorkMetadata = async (id, username) => {
  // TODO: do this all in a single transaction?
  // <= Yes, WTF is this
  // I think we are done.

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
      .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id')
      .where('id', '=', id);

  const work = await query();
  if (work.length === 0) throw new Error(`There is no work with id ${id} in the database.`);
  return work;
};

/**
 * Returns list of works by circle, tag or VA.
 * @param {Number[]} id Which id to filter by.
 * @param {String} field Which field to filter by.
 */
const getWorksBy = ({ id, field, username = '' } = {}) => {
  let workIdQuery;
  const ratingSubQuery = knex('t_review')
    .select(['t_review.work_id', 't_review.rating'])
    .join('t_work', 't_work.id', 't_review.work_id')
    .where('t_review.user_name', username)
    .as('userrate');

  switch (field) {
    case 'circle':
      return knex('staticMetadata')
        .select(['staticMetadata.*', 'userrate.rating AS userRating'])
        .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id')
        .where('circle_id', '=', id[0]);

    case 'tag':
      workIdQuery = knex('r_tag_work')
        .select('work_id')
        .whereIn('tag_id', id)
        .groupBy('work_id')
        .havingRaw('COUNT(DISTINCT tag_id) = ?', [id.length]);
      return knex('staticMetadata')
        .select(['staticMetadata.*', 'userrate.rating AS userRating'])
        .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id')
        .where('id', 'in', workIdQuery);

    case 'va':
      workIdQuery = knex('r_va_work').select('work_id').where('va_id', '=', id[0]);
      return knex('staticMetadata')
        .select(['staticMetadata.*', 'userrate.rating AS userRating'])
        .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id')
        .where('id', 'in', workIdQuery);

    default:
      return knex('staticMetadata')
        .select(['staticMetadata.*', 'userrate.rating AS userRating'])
        .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id');
  }
};

/**
 * 根据关键字查询音声
 * @param {String} keyword
 */
const getWorksByKeyWord = ({ keyword, username = 'admin' } = {}) => {
  const ratingSubQuery = knex('t_review')
    .select(['t_review.work_id', 't_review.rating'])
    .join('t_work', 't_work.id', 't_review.work_id')
    .where('t_review.user_name', username)
    .as('userrate');

  const workid = keyword.match(/((R|r)(J|j))?(\d+)/) ? keyword.match(/((R|r)(J|j))?(\d+)/)[4] : '';
  if (workid) {
    return knex('staticMetadata')
      .select(['staticMetadata.*', 'userrate.rating AS userRating'])
      .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id')
      .where('id', '=', workid);
  }

  const circleIdQuery = knex('t_circle').select('id').where('name', 'like', `%${keyword}%`);

  const tagIdQuery = knex('t_tag').select('id').where('name', 'like', `%${keyword}%`);
  const vaIdQuery = knex('t_va').select('id').where('name', 'like', `%${keyword}%`);

  const workIdQuery = knex('r_tag_work')
    .select('work_id')
    .where('tag_id', 'in', tagIdQuery)
    .union([knex('r_va_work').select('work_id').where('va_id', 'in', vaIdQuery)]);

  return knex('staticMetadata')
    .select(['staticMetadata.*', 'userrate.rating AS userRating'])
    .leftJoin(ratingSubQuery, 'userrate.work_id', 'staticMetadata.id')
    .where('title', 'like', `%${keyword}%`)
    .orWhere('circle_id', 'in', circleIdQuery)
    .orWhere('id', 'in', workIdQuery);
};

/**
 * 获取所有社团/标签/声优的元数据列表
 * @param {Starting} field ['circle', 'tag', 'va'] 中的一个
 */
const getLabels = field => {
  if (field === 'circle') {
    return knex('t_work')
      .join(`t_${field}`, `${field}_id`, '=', `t_${field}.id`)
      .select(`t_${field}.id`, 'name')
      .groupBy(`${field}_id`)
      .count(`${field}_id as count`);
  } else if (field === 'tag' || field === 'va') {
    return knex(`r_${field}_work`)
      .join(`t_${field}`, `${field}_id`, '=', 'id')
      .select('id', 'name')
      .groupBy(`${field}_id`)
      .count(`${field}_id as count`);
  }
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
  return Promise.all(ids.map(id => knex(`t_${field}`).select('*').where('id', '=', id).first()));
};

module.exports = {
  getLabels,
  getMetadata,
  getWorkMetadata,
  getWorksBy,
  getWorksByKeyWord,
};
