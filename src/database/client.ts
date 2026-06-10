// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import { config } from '../../config.js';
import schema from './schema/tables.js';
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
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

export {
  closeDatabaseConnection,
  databaseExist,
  databasePath,
  drizzleDb as db,
  initializeDatabaseConnection,
  libsql,
};
