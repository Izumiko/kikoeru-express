const { index, integer, primaryKey, real, sqliteTable, text } = require('drizzle-orm/sqlite-core');

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
    circleId: integer('circle_id').notNull(),
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
    tagId: integer('tag_id'),
    workId: integer('work_id'),
  },
  table => ({
    pk: primaryKey({ columns: [table.tagId, table.workId] }),
  })
);

const voiceActorWorks = sqliteTable(
  'r_va_work',
  {
    vaId: text('va_id'),
    workId: integer('work_id'),
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
    userName: text('user_name').notNull(),
    workId: text('work_id').notNull(),
    rating: integer('rating'),
    reviewText: text('review_text'),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
    progress: text('progress'),
  },
  table => ({
    pk: primaryKey({ columns: [table.userName, table.workId] }),
  })
);

module.exports = {
  circles,
  reviews,
  tagWorks,
  tags,
  users,
  voiceActors,
  voiceActorWorks,
  works,
};
