import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, sqliteView, text } from 'drizzle-orm/sqlite-core';

const circles = sqliteTable('t_circle', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
});

const works = sqliteTable(
  't_work',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    rootFolder: text('root_folder').notNull(),
    dir: text('dir').notNull(),
    title: text('title').notNull(),
    circleId: integer('circle_id')
      .notNull()
      .references(() => circles.id),
    nsfw: integer('nsfw', { mode: 'boolean' }),
    release: text('release'),
    dlCount: integer('dl_count'),
    price: integer('price'),
    reviewCount: integer('review_count'),
    rateCount: integer('rate_count'),
    rateAverage2dp: real('rate_average_2dp'),
    rateCountDetail: text('rate_count_detail'),
    rank: text('rank'),
  },
  table => ({
    workIndex: index('t_work_index').on(
      table.circleId,
      table.release,
      table.dlCount,
      table.reviewCount,
      table.price,
      table.rateAverage2dp
    ),
  })
);

const tags = sqliteTable('t_tag', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
});

const voiceActors = sqliteTable('t_va', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

const tagWorks = sqliteTable(
  'r_tag_work',
  {
    tagId: integer('tag_id').references(() => tags.id),
    workId: integer('work_id').references(() => works.id),
  },
  table => ({
    pk: primaryKey({ columns: [table.tagId, table.workId] }),
  })
);

const voiceActorWorks = sqliteTable(
  'r_va_work',
  {
    vaId: text('va_id').references(() => voiceActors.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
    workId: integer('work_id').references(() => works.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  },
  table => ({
    pk: primaryKey({ columns: [table.vaId, table.workId] }),
  })
);

const users = sqliteTable('t_user', {
  name: text('name').primaryKey().notNull(),
  password: text('password').notNull(),
  group: text('group').notNull(),
});

const reviews = sqliteTable(
  't_review',
  {
    userName: text('user_name')
      .notNull()
      .references(() => users.name, { onDelete: 'cascade' }),
    workId: text('work_id')
      .notNull()
      .references(() => works.id, { onDelete: 'cascade' }),
    rating: integer('rating'),
    reviewText: text('review_text'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
    progress: text('progress'),
  },
  table => ({
    pk: primaryKey({ columns: [table.userName, table.workId] }),
  })
);

const staticMetadata = sqliteView('staticMetadata', {
  id: integer('id'),
  title: text('title'),
  circleId: integer('circle_id'),
  name: text('name'),
  circleObj: text('circleObj'),
  nsfw: integer('nsfw', { mode: 'boolean' }),
  release: text('release'),
  dlCount: integer('dl_count'),
  price: integer('price'),
  reviewCount: integer('review_count'),
  rateCount: integer('rate_count'),
  rateAverage2dp: real('rate_average_2dp'),
  rateCountDetail: text('rate_count_detail'),
  rank: text('rank'),
  vaObj: text('vaObj'),
  tagObj: text('tagObj'),
}).as(sql`
  SELECT baseQueryWithVA.*,
    json_object('tags', json_group_array(json_object('id', t_tag.id, 'name', t_tag.name))) AS tagObj
  FROM (
    SELECT baseQuery.*,
      json_object('vas', json_group_array(json_object('id', t_va.id, 'name', t_va.name))) AS vaObj
    FROM (
      SELECT t_work.id,
        t_work.title,
        t_work.circle_id,
        t_circle.name,
        json_object('id', t_work.circle_id, 'name', t_circle.name) AS circleObj,
        t_work.nsfw,
        t_work.release,
        t_work.dl_count,
        t_work.price,
        t_work.review_count,
        t_work.rate_count,
        t_work.rate_average_2dp,
        t_work.rate_count_detail,
        t_work.rank
      FROM t_work
      JOIN t_circle ON t_circle.id = t_work.circle_id
    ) AS baseQuery
    JOIN r_va_work ON r_va_work.work_id = baseQuery.id
    JOIN t_va ON t_va.id = r_va_work.va_id
    GROUP BY baseQuery.id
  ) AS baseQueryWithVA
  LEFT JOIN r_tag_work ON r_tag_work.work_id = baseQueryWithVA.id
  LEFT JOIN t_tag ON t_tag.id = r_tag_work.tag_id
  GROUP BY baseQueryWithVA.id
`);

export {
  circles,
  reviews,
  staticMetadata,
  tagWorks,
  tags,
  users,
  voiceActors,
  voiceActorWorks,
  works,
};

export default {
  circles,
  reviews,
  staticMetadata,
  tagWorks,
  tags,
  users,
  voiceActors,
  voiceActorWorks,
  works,
};
