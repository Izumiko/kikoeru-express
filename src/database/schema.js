const path = require('path');

const { migrate } = require('drizzle-orm/libsql/migrator');

const { db, libsql } = require('./libsql-client');

const dbVersion = '20210502081522';
const migrationsFolder = path.join(__dirname, 'drizzle');

const hasLegacySchema = async () => {
  const result = await libsql.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?;",
    args: ['t_circle'],
  });

  return result.rows.length > 0;
};

// 数据库结构由 src/database/schema/tables.js 定义，并通过 drizzle-kit 生成迁移文件。
const createSchema = async () => {
  if (await hasLegacySchema()) {
    console.log(' * 数据库结构已经存在.');
    return;
  }

  await libsql.execute('DROP TABLE IF EXISTS __drizzle_migrations;');
  await migrate(db, { migrationsFolder });
  console.log(' * 成功构建数据库结构.');
};

module.exports = { createSchema, dbVersion };
