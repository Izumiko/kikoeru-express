/* eslint-disable node/no-missing-require */
const { DatabaseSync } = require('node:sqlite');

const schema = require('./schema');

const createSchemaSql = `
  CREATE TABLE t_circle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE t_work (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    root_folder TEXT NOT NULL,
    dir TEXT NOT NULL,
    title TEXT NOT NULL,
    circle_id INTEGER NOT NULL,
    nsfw INTEGER,
    release TEXT,
    dl_count INTEGER,
    price INTEGER,
    review_count INTEGER,
    rate_count INTEGER,
    rate_average_2dp REAL,
    rate_count_detail TEXT,
    rank TEXT,
    FOREIGN KEY(circle_id) REFERENCES t_circle(id)
  );

  CREATE INDEX t_work_index
    ON t_work(circle_id, release, dl_count, review_count, price, rate_average_2dp);

  CREATE TABLE t_tag (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE t_va (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE r_tag_work (
    tag_id INTEGER,
    work_id INTEGER,
    PRIMARY KEY(tag_id, work_id),
    FOREIGN KEY(tag_id) REFERENCES t_tag(id),
    FOREIGN KEY(work_id) REFERENCES t_work(id)
  );

  CREATE TABLE r_va_work (
    va_id TEXT,
    work_id INTEGER,
    PRIMARY KEY(va_id, work_id),
    FOREIGN KEY(va_id) REFERENCES t_va(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY(work_id) REFERENCES t_work(id) ON UPDATE CASCADE ON DELETE CASCADE
  );

  CREATE TABLE t_user (
    name TEXT NOT NULL PRIMARY KEY,
    password TEXT NOT NULL,
    "group" TEXT NOT NULL
  );

  CREATE TABLE t_review (
    user_name TEXT NOT NULL,
    work_id TEXT NOT NULL,
    rating INTEGER,
    review_text TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    progress TEXT,
    PRIMARY KEY(user_name, work_id),
    FOREIGN KEY(user_name) REFERENCES t_user(name) ON DELETE CASCADE,
    FOREIGN KEY(work_id) REFERENCES t_work(id) ON DELETE CASCADE
  );

  CREATE VIEW IF NOT EXISTS staticMetadata AS
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
    GROUP BY baseQueryWithVA.id;
`;

const insertFixture = db => {
  db.exec(`
    INSERT INTO t_circle(id, name) VALUES (10, 'Alpha Circle'), (11, 'Beta Circle');
    INSERT INTO t_work(
      id, root_folder, dir, title, circle_id, nsfw, release, dl_count, price,
      review_count, rate_count, rate_average_2dp, rate_count_detail, rank
    ) VALUES
      (100, 'VoiceWork', 'RJ000100', 'Alpha Work', 10, 0, '2021-01-02', 100, 1100, 3, 4, 4.5, '{"5":3,"4":1}', '{"daily":1}'),
      (101, 'VoiceWork', 'RJ000101', 'Beta Work', 11, 0, '2021-02-03', 50, 770, 1, 2, 3.5, '{"4":1,"3":1}', NULL);
    INSERT INTO t_tag(id, name) VALUES (20, 'Relax'), (21, 'Drama');
    INSERT INTO t_va(id, name) VALUES ('va-alpha', 'Alpha VA'), ('va-beta', 'Beta VA');
    INSERT INTO r_tag_work(tag_id, work_id) VALUES (20, 100), (21, 100), (20, 101);
    INSERT INTO r_va_work(va_id, work_id) VALUES ('va-alpha', 100), ('va-beta', 101);
  `);
};

const createProbeDatabase = () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(createSchemaSql);
  insertFixture(db);
  return db;
};

const readStaticMetadata = db =>
  db.prepare('SELECT * FROM staticMetadata ORDER BY id ASC').all();

module.exports = {
  createProbeDatabase,
  readStaticMetadata,
  schema,
};
