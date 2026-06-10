// @ts-nocheck
import fs from 'fs';
import { hashLegacyPassword } from '../modules/auth/service.js';
import { config, updateConfig } from '../../config.js';
import { databaseExist } from './client.js';
import { createUser } from './repositories.js';
import { createSchema } from './schema.js';

function initDatabaseDir() {
  const databaseFolderDir = config.databaseFolderDir;
  if (!fs.existsSync(databaseFolderDir)) {
    try {
      fs.mkdirSync(databaseFolderDir, { recursive: true });
    } catch (err) {
      console.error(` ! 在创建存放数据库文件的文件夹时出错: ${err.message}`);
    }
  }
}

const initApp = async () => {
  if (databaseExist) return;

  initDatabaseDir();
  await createSchema();

  try {
    await createUser({
      name: 'admin',
      password: hashLegacyPassword('admin'),
      group: 'administrator',
    });
    updateConfig();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

export { initApp };
