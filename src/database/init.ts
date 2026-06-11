import fs from 'fs';
import { hashPassword } from '../modules/auth/service.js';
import { config, updateConfig } from '../../config.js';
import { databaseExist } from './client.js';
import { createUser } from './repositories.js';
import { createSchema } from './schema.js';

function initDatabaseDir(): void {
  const databaseFolderDir = config.databaseFolderDir;
  if (!fs.existsSync(databaseFolderDir)) {
    try {
      fs.mkdirSync(databaseFolderDir, { recursive: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(` ! 在创建存放数据库文件的文件夹时出错: ${message}`);
    }
  }
}

const initApp = async (): Promise<void> => {
  initDatabaseDir();
  await createSchema();

  if (databaseExist) return;

  try {
    await createUser({
      name: 'admin',
      password: hashPassword('admin'),
      group: 'administrator',
    });
    updateConfig();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exit(1);
  }
};

export { initApp };
