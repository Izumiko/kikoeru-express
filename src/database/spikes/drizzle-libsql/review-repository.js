const ratingSelectSql = `
  SELECT
    t_review.work_id,
    t_review.rating AS userRating,
    t_review.review_text,
    t_review.progress,
    strftime('%Y-%m-%d %H-%M-%S', t_review.updated_at, 'localtime') AS updated_at,
    t_review.user_name
  FROM t_review
  JOIN t_work ON t_work.id = t_review.work_id
  WHERE t_review.user_name = ?
`;

const withTransaction = async (client, callback) => {
  await client.execute('BEGIN');
  try {
    const result = await callback();
    await client.execute('COMMIT');
    return result;
  } catch (error) {
    await client.execute('ROLLBACK');
    throw error;
  }
};

const createReviewRepository = client => {
  const updateUserReview = async (
    username,
    workid,
    rating,
    review_text = '',
    progress = '',
    starOnly = true,
    progressOnly = false
  ) =>
    withTransaction(client, async () => {
      const workId = String(workid);
      if (starOnly) {
        await client.execute({
          sql: 'UPDATE t_review SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE user_name = ? AND work_id = ?',
          args: [rating, username, workId],
        });
        await client.execute({
          sql: 'INSERT OR IGNORE INTO t_review (user_name, work_id, rating) VALUES (?, ?, ?)',
          args: [username, workId, rating],
        });
      } else if (progressOnly) {
        await client.execute({
          sql: 'UPDATE t_review SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE user_name = ? AND work_id = ?',
          args: [progress, username, workId],
        });
        await client.execute({
          sql: 'INSERT OR IGNORE INTO t_review (user_name, work_id, progress) VALUES (?, ?, ?)',
          args: [username, workId, progress],
        });
      } else {
        await client.execute({
          sql: `
            UPDATE t_review
            SET rating = ?, review_text = ?, progress = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_name = ? AND work_id = ?
          `,
          args: [rating, review_text, progress, username, workId],
        });
        await client.execute({
          sql: 'INSERT OR IGNORE INTO t_review (user_name, work_id, rating, review_text, progress) VALUES (?, ?, ?, ?, ?)',
          args: [username, workId, rating, review_text, progress],
        });
      }
    });

  const deleteUserReview = (username, workid) =>
    withTransaction(client, () =>
      client.execute({
        sql: 'DELETE FROM t_review WHERE user_name = ? AND work_id = ?',
        args: [username, String(workid)],
      })
    );

  const getWorksWithReviews = async ({
    username = '',
    limit = 1000,
    offset = 0,
    orderBy = 'release',
    sortOption = 'desc',
    filter,
  } = {}) => {
    const filterSql = filter ? 'WHERE progress = ?' : '';
    const filterArgs = filter ? [filter] : [];
    const commonArgs = [username, ...filterArgs];

    const works = await client.execute({
      sql: `
        SELECT
          staticMetadata.*,
          userrate.userRating,
          userrate.review_text,
          userrate.progress,
          userrate.updated_at,
          userrate.user_name
        FROM staticMetadata
        JOIN (${ratingSelectSql}) AS userrate ON userrate.work_id = staticMetadata.id
        ${filterSql}
        ORDER BY ${orderBy} ${sortOption}, release DESC, id DESC
        LIMIT ? OFFSET ?
      `,
      args: [...commonArgs, limit, offset],
    });
    const totalCount = await client.execute({
      sql: `
        SELECT COUNT(id) AS count
        FROM staticMetadata
        JOIN (${ratingSelectSql}) AS userrate ON userrate.work_id = staticMetadata.id
        ${filterSql}
      `,
      args: commonArgs,
    });

    return {
      works: works.rows,
      totalCount: totalCount.rows,
    };
  };

  return {
    deleteUserReview,
    getWorksWithReviews,
    updateUserReview,
  };
};

module.exports = {
  createReviewRepository,
};
