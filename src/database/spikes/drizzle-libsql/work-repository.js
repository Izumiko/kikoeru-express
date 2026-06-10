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

const insertOrIgnore = (client, sql, args) =>
  client.execute({
    sql: sql.replace('INSERT INTO', 'INSERT OR IGNORE INTO'),
    args,
  });

const persistWorkRelationships = async (client, work, options = {}) => {
  if (options.includeVA) {
    if (options.replaceVA) {
      await client.execute({
        sql: 'DELETE FROM r_va_work WHERE work_id = ?',
        args: [work.id],
      });
    }

    for (const va of work.vas) {
      await insertOrIgnore(client, 'INSERT INTO t_va(id, name) VALUES (?, ?)', [va.id, va.name]);
      await insertOrIgnore(client, 'INSERT INTO r_va_work(va_id, work_id) VALUES (?, ?)', [va.id, work.id]);
    }
  }

  if (options.includeTags) {
    if (options.purgeTags) {
      await client.execute({
        sql: 'DELETE FROM r_tag_work WHERE work_id = ?',
        args: [work.id],
      });
    }

    for (const tag of work.tags) {
      await insertOrIgnore(client, 'INSERT INTO t_tag(id, name) VALUES (?, ?)', [tag.id, tag.name]);
      await insertOrIgnore(client, 'INSERT INTO r_tag_work(tag_id, work_id) VALUES (?, ?)', [tag.id, work.id]);
    }
  }
};

const createWorkRepository = client => {
  const insertWorkMetadata = work =>
    withTransaction(client, async () => {
      await insertOrIgnore(client, 'INSERT INTO t_circle(id, name) VALUES (?, ?)', [work.circle.id, work.circle.name]);
      await client.execute({
        sql: `
          INSERT INTO t_work(
            id, root_folder, dir, title, circle_id, nsfw, release, dl_count, price,
            review_count, rate_count, rate_average_2dp, rate_count_detail, rank
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          work.id,
          work.rootFolderName,
          work.dir,
          work.title,
          work.circle.id,
          work.nsfw,
          work.release,
          work.dl_count,
          work.price,
          work.review_count,
          work.rate_count,
          work.rate_average_2dp,
          JSON.stringify(work.rate_count_detail),
          work.rank ? JSON.stringify(work.rank) : null,
        ],
      });
      await persistWorkRelationships(client, work, {
        includeTags: true,
        includeVA: true,
      });
    });

  const updateWorkMetadata = (work, options = {}) =>
    withTransaction(client, async () => {
      await client.execute({
        sql: `
          UPDATE t_work
          SET dl_count = ?,
              price = ?,
              review_count = ?,
              rate_count = ?,
              rate_average_2dp = ?,
              rate_count_detail = ?,
              rank = ?
          WHERE id = ?
        `,
        args: [
          work.dl_count,
          work.price,
          work.review_count,
          work.rate_count,
          work.rate_average_2dp,
          JSON.stringify(work.rate_count_detail),
          work.rank ? JSON.stringify(work.rank) : null,
          work.id,
        ],
      });

      await persistWorkRelationships(client, work, {
        includeTags: options.includeTags || options.refreshAll,
        includeVA: options.includeVA || options.refreshAll,
        purgeTags: options.purgeTags,
        replaceVA: options.includeVA || options.refreshAll,
      });

      if (options.includeNSFW) {
        await client.execute({
          sql: 'UPDATE t_work SET nsfw = ? WHERE id = ?',
          args: [work.nsfw, work.id],
        });
      }

      if (options.refreshAll) {
        await client.execute({
          sql: 'UPDATE t_work SET nsfw = ?, title = ?, release = ? WHERE id = ?',
          args: [work.nsfw, work.title, work.release, work.id],
        });
      }
    });

  const cleanupOrphans = async (circle, tags, vas) => {
    const circleCount = await client.execute({
      sql: 'SELECT COUNT(*) AS count FROM t_work WHERE circle_id = ?',
      args: [circle],
    });
    if (circleCount.rows[0].count === 0) {
      await client.execute({
        sql: 'DELETE FROM t_circle WHERE id = ?',
        args: [circle],
      });
    }

    for (const tag of tags) {
      const tagCount = await client.execute({
        sql: 'SELECT COUNT(*) AS count FROM r_tag_work WHERE tag_id = ?',
        args: [tag],
      });
      if (tagCount.rows[0].count === 0) {
        await client.execute({
          sql: 'DELETE FROM t_tag WHERE id = ?',
          args: [tag],
        });
      }
    }

    for (const va of vas) {
      const vaCount = await client.execute({
        sql: 'SELECT COUNT(*) AS count FROM r_va_work WHERE va_id = ?',
        args: [va],
      });
      if (vaCount.rows[0].count === 0) {
        await client.execute({
          sql: 'DELETE FROM t_va WHERE id = ?',
          args: [va],
        });
      }
    }
  };

  const removeWork = id =>
    withTransaction(client, async () => {
      const circle = await client.execute({
        sql: 'SELECT circle_id FROM t_work WHERE id = ?',
        args: [id],
      });
      const tags = await client.execute({
        sql: 'SELECT tag_id FROM r_tag_work WHERE work_id = ?',
        args: [id],
      });
      const vas = await client.execute({
        sql: 'SELECT va_id FROM r_va_work WHERE work_id = ?',
        args: [id],
      });

      await client.execute({
        sql: 'DELETE FROM r_tag_work WHERE work_id = ?',
        args: [id],
      });
      await client.execute({
        sql: 'DELETE FROM r_va_work WHERE work_id = ?',
        args: [id],
      });
      await client.execute({
        sql: 'DELETE FROM t_review WHERE work_id = ?',
        args: [id],
      });
      await client.execute({
        sql: 'DELETE FROM t_work WHERE id = ?',
        args: [id],
      });

      await cleanupOrphans(
        circle.rows[0].circle_id,
        tags.rows.map(tag => tag.tag_id),
        vas.rows.map(va => va.va_id)
      );
    });

  return {
    insertWorkMetadata,
    removeWork,
    updateWorkMetadata,
  };
};

module.exports = {
  createWorkRepository,
};
