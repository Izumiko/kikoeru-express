const path = require('path');

const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const fs = require('fs');

const { config } = require('../../config');
const schema = require('./schema/tables.js');

const rootDir = path.join(__dirname, '../..');
const connEnv = process.env.KNEX_ENV || process.env.NODE_ENV || 'development';
const databasePath =
  connEnv === 'test' ? path.join(rootDir, 'test/db-test.sqlite3') : path.join(config.databaseFolderDir, 'db.sqlite3');
const databaseExist = fs.existsSync(databasePath);
const libsql = createClient({ url: 'file:' + databasePath });
const drizzleDb = drizzle({ client: libsql, schema });

const initializeLibsqlConnection = async () => {
  await libsql.execute('PRAGMA foreign_keys = ON;');
  await libsql.execute(`PRAGMA busy_timeout = ${config.dbBusyTimeout};`);
};

let libsqlClosed = false;

const closeLibsqlConnection = async () => {
  if (libsqlClosed) return;
  libsqlClosed = true;
  await libsql.close();
};

if (process.env.NODE_ENV === 'test' && typeof global.after === 'function') {
  global.after(async () => {
    await closeLibsqlConnection();
  });
}

module.exports = {
  closeLibsqlConnection,
  databaseExist,
  databasePath,
  db: drizzleDb,
  initializeLibsqlConnection,
  libsql,
};
