const { knex } = require('../client.js');

/**
 * Takes a work metadata object and inserts it into the database.
 * @param {Object} work Work object.
 */
// Using trx as a query builder:
const insertWorkMetadata = work =>
  knex.transaction(trx =>
    trx
      .raw(
        trx('t_circle')
          .insert({
            id: work.circle.id,
            name: work.circle.name,
          })
          .toString()
          .replace('insert', 'insert or ignore')
      )
      .then(() =>
        trx('t_work').insert({
          id: work.id,
          root_folder: work.rootFolderName,
          dir: work.dir,
          title: work.title,
          circle_id: work.circle.id,
          nsfw: work.nsfw,
          release: work.release,

          dl_count: work.dl_count,
          price: work.price,
          review_count: work.review_count,
          rate_count: work.rate_count,
          rate_average_2dp: work.rate_average_2dp,
          rate_count_detail: JSON.stringify(work.rate_count_detail),
          rank: work.rank ? JSON.stringify(work.rank) : null,
        })
      )
      .then(() => {
        // Now that work is in the database, insert relationships
        const promises = [];

        for (let i = 0; i < work.tags.length; i += 1) {
          promises.push(
            trx
              .raw(
                trx('t_tag')
                  .insert({
                    id: work.tags[i].id,
                    name: work.tags[i].name,
                  })
                  .toString()
                  .replace('insert', 'insert or ignore')
              )
              .then(() =>
                trx('r_tag_work').insert({
                  tag_id: work.tags[i].id,
                  work_id: work.id,
                })
              )
          );
        }

        for (let i = 0; i < work.vas.length; i += 1) {
          promises.push(
            trx
              .raw(
                trx('t_va')
                  .insert({
                    id: work.vas[i].id,
                    name: work.vas[i].name,
                  })
                  .toString()
                  .replace('insert', 'insert or ignore')
              )
              .then(() =>
                trx.raw(
                  trx('r_va_work')
                    .insert({
                      va_id: work.vas[i].id,
                      work_id: work.id,
                    })
                    .toString()
                    .replace('insert', 'insert or ignore')
                )
              )
          );
        }

        return Promise.all(promises).then(() => trx);
      })
  );

/**
 * 更新音声的动态元数据
 * @param {Object} work Work object.
 */
const updateWorkMetadata = (work, options = {}) =>
  knex.transaction(async trx => {
    await trx('t_work')
      .where('id', '=', work.id)
      .update({
        dl_count: work.dl_count,
        price: work.price,
        review_count: work.review_count,
        rate_count: work.rate_count,
        rate_average_2dp: work.rate_average_2dp,
        rate_count_detail: JSON.stringify(work.rate_count_detail),
        rank: work.rank ? JSON.stringify(work.rank) : null,
      });

    if (options.includeVA || options.refreshAll) {
      await trx('r_va_work').where('work_id', work.id).del();
      for (const va of work.vas) {
        await trx.raw('INSERT OR IGNORE INTO t_va(id, name) VALUES (?, ?)', [va.id, va.name]);
        await trx.raw('INSERT OR IGNORE INTO r_va_work(va_id, work_id) VALUES (?, ?)', [va.id, work.id]);
      }
    }
    if (options.includeTags || options.refreshAll) {
      if (options.purgeTags) {
        await trx('r_tag_work').where('work_id', work.id).del();
      }
      for (const tag of work.tags) {
        await trx.raw('INSERT OR IGNORE INTO t_tag(id, name) VALUES (?, ?)', [tag.id, tag.name]);
        await trx.raw('INSERT OR IGNORE INTO r_tag_work(tag_id, work_id) VALUES (?, ?)', [tag.id, work.id]);
      }
    }

    // Fix a bug caused by DLsite changes
    if (options.includeNSFW) {
      await trx('t_work').where('id', '=', work.id).update({
        nsfw: work.nsfw,
      });
    }

    if (options.refreshAll) {
      await trx('t_work').where('id', '=', work.id).update({
        nsfw: work.nsfw,
        title: work.title,
        release: work.release,
      });
    }
  });

/**
 * Tests if the given circle, tags and VAs are orphans and if so, removes them.
 * @param {*} trx Knex transaction object.
 * @param {*} circle Circle id to check.
 * @param {*} tags Array of tag ids to check.
 * @param {*} vas Array of VA ids to check.
 */
const cleanupOrphans = async (trxProvider, circle, tags, vas) => {
  const trx = await trxProvider();
  const getCount = (tableName, colName, colValue) =>
    new Promise((resolveCount, rejectCount) => {
      trx(tableName)
        .select(colName)
        .where(colName, '=', colValue)
        .count()
        .first()
        .then(res => res['count(*)'])
        .then(count => resolveCount(count))
        .catch(err => rejectCount(err));
    });

  const promises = [];
  promises.push(
    new Promise((resolveCircle, rejectCircle) => {
      getCount('t_work', 'circle_id', circle).then(count => {
        if (count === 0) {
          trx('t_circle')
            .del()
            .where('id', '=', circle)
            .then(() => resolveCircle())
            .catch(err => rejectCircle(err));
        } else {
          resolveCircle();
        }
      });
    })
  );

  for (let i = 0; i < tags.length; i += 1) {
    const tag = tags[i];
    const count = await getCount('r_tag_work', 'tag_id', tag);

    if (count === 0) {
      promises.push(trx('t_tag').delete().where('id', '=', tag));
    }
  }

  for (let i = 0; i < vas.length; i += 1) {
    const va = vas[i];
    const count = await getCount('r_va_work', 'va_id', va);

    if (count === 0) {
      promises.push(trx('t_va').delete().where('id', '=', va));
    }
  }

  await Promise.all(promises);
};

/**
 * Removes a work and then its orphaned circles, tags & VAs from the database.
 * @param {Integer} id Work id.
 */
const removeWork = async (id, trxProvider) => {
  const trx = await trxProvider();
  // Save circle, tags and VAs to array for later testing
  const circle = await trx('t_work').select('circle_id').where('id', '=', id).first();
  const tags = await trx('r_tag_work').select('tag_id').where('work_id', '=', id);
  const vas = await trx('r_va_work').select('va_id').where('work_id', '=', id);

  await trx('r_tag_work').del().where('work_id', '=', id);
  await trx('r_va_work').del().where('work_id', '=', id);
  await trx('t_review').del().where('work_id', '=', id);
  await trx('t_work').del().where('id', '=', id);
  await cleanupOrphans(
    trxProvider,
    circle.circle_id,
    tags.map(tag => tag.tag_id),
    vas.map(va => va.va_id)
  );
};

module.exports = {
  insertWorkMetadata,
  removeWork,
  updateWorkMetadata,
};
