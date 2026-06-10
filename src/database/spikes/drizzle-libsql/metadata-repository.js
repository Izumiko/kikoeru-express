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

const rows = result => result.rows;
const placeholders = values => values.map(() => '?').join(', ');

const createMetadataRepository = client => {
  const getWorkMetadata = async (id, username) => {
    const result = await client.execute({
      sql: `
        SELECT
          staticMetadata.*,
          userrate.userRating,
          userrate.review_text,
          userrate.progress,
          userrate.updated_at,
          userrate.user_name
        FROM staticMetadata
        LEFT JOIN (${ratingSelectSql}) AS userrate ON userrate.work_id = staticMetadata.id
        WHERE id = ?
      `,
      args: [username, id],
    });

    if (result.rows.length === 0) throw new Error(`There is no work with id ${id} in the database.`);
    return rows(result);
  };

  const getWorksBy = async ({ id, field, username = '' } = {}) => {
    const args = [username];
    let whereSql = '';

    switch (field) {
      case 'circle':
        whereSql = 'WHERE circle_id = ?';
        args.push(id[0]);
        break;

      case 'tag':
        whereSql = `
          WHERE id IN (
            SELECT work_id
            FROM r_tag_work
            WHERE tag_id IN (${placeholders(id)})
            GROUP BY work_id
            HAVING COUNT(DISTINCT tag_id) = ?
          )
        `;
        args.push(...id, id.length);
        break;

      case 'va':
        whereSql = 'WHERE id IN (SELECT work_id FROM r_va_work WHERE va_id = ?)';
        args.push(id[0]);
        break;

      default:
        break;
    }

    const result = await client.execute({
      sql: `
        SELECT staticMetadata.*, userrate.rating AS userRating
        FROM staticMetadata
        LEFT JOIN (
          SELECT t_review.work_id, t_review.rating
          FROM t_review
          JOIN t_work ON t_work.id = t_review.work_id
          WHERE t_review.user_name = ?
        ) AS userrate ON userrate.work_id = staticMetadata.id
        ${whereSql}
      `,
      args,
    });

    return rows(result);
  };

  const getWorksByKeyWord = async ({ keyword, username = 'admin' } = {}) => {
    const workid = keyword.match(/((R|r)(J|j))?(\d+)/) ? keyword.match(/((R|r)(J|j))?(\d+)/)[4] : '';
    if (workid) {
      const result = await client.execute({
        sql: `
          SELECT staticMetadata.*, userrate.rating AS userRating
          FROM staticMetadata
          LEFT JOIN (
            SELECT t_review.work_id, t_review.rating
            FROM t_review
            JOIN t_work ON t_work.id = t_review.work_id
            WHERE t_review.user_name = ?
          ) AS userrate ON userrate.work_id = staticMetadata.id
          WHERE id = ?
        `,
        args: [username, workid],
      });
      return rows(result);
    }

    const result = await client.execute({
      sql: `
        SELECT staticMetadata.*, userrate.rating AS userRating
        FROM staticMetadata
        LEFT JOIN (
          SELECT t_review.work_id, t_review.rating
          FROM t_review
          JOIN t_work ON t_work.id = t_review.work_id
          WHERE t_review.user_name = ?
        ) AS userrate ON userrate.work_id = staticMetadata.id
        WHERE title LIKE ?
          OR circle_id IN (SELECT id FROM t_circle WHERE name LIKE ?)
          OR id IN (
            SELECT work_id FROM r_tag_work WHERE tag_id IN (SELECT id FROM t_tag WHERE name LIKE ?)
            UNION
            SELECT work_id FROM r_va_work WHERE va_id IN (SELECT id FROM t_va WHERE name LIKE ?)
          )
      `,
      args: [username, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`],
    });

    return rows(result);
  };

  const getLabels = async field => {
    if (field === 'circle') {
      const result = await client.execute(`
        SELECT t_circle.id, name, COUNT(circle_id) AS count
        FROM t_work
        JOIN t_circle ON circle_id = t_circle.id
        GROUP BY circle_id
      `);
      return rows(result);
    } else if (field === 'tag' || field === 'va') {
      const result = await client.execute(`
        SELECT id, name, COUNT(${field}_id) AS count
        FROM r_${field}_work
        JOIN t_${field} ON ${field}_id = id
        GROUP BY ${field}_id
      `);
      return rows(result);
    }
    return undefined;
  };

  const getMetadata = async ({ field = 'circle', ids } = {}) => {
    const validFields = ['circle', 'tag', 'va'];
    if (!validFields.includes(field)) throw new Error('无效的查询域');

    return Promise.all(
      ids.map(async id => {
        const result = await client.execute({
          sql: `SELECT * FROM t_${field} WHERE id = ?`,
          args: [id],
        });
        return result.rows[0];
      })
    );
  };

  return {
    getLabels,
    getMetadata,
    getWorkMetadata,
    getWorksBy,
    getWorksByKeyWord,
  };
};

module.exports = {
  createMetadataRepository,
};
