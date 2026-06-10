const fs = require('fs');
const path = require('path');

const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');

const { config } = require('../../config');
const schema = require('./schema/tables.js');

const rootDir = path.join(__dirname, '../..');
const connEnv = process.env.DATABASE_ENV || process.env.NODE_ENV || 'development';
const databasePath =
  connEnv === 'test' ? path.join(rootDir, 'test/db-test.sqlite3') : path.join(config.databaseFolderDir, 'db.sqlite3');
const databaseExist = fs.existsSync(databasePath);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const libsql = createClient({ url: 'file:' + databasePath });
const drizzleDb = drizzle({ client: libsql, schema });

const initializeDatabaseConnection = async () => {
  await libsql.execute('PRAGMA foreign_keys = ON;');
  await libsql.execute(`PRAGMA busy_timeout = ${config.dbBusyTimeout};`);
};

let databaseClosed = false;

const closeDatabaseConnection = async () => {
  if (databaseClosed) return;
  databaseClosed = true;
  await libsql.close();
};

if (process.env.NODE_ENV === 'test' && typeof global.after === 'function') {
  global.after(async () => {
    await closeDatabaseConnection();
  });
}

initializeDatabaseConnection();

module.exports = {
  closeDatabaseConnection,
  databaseExist,
  databasePath,
  db: drizzleDb,
  initializeDatabaseConnection,
  libsql,
};
