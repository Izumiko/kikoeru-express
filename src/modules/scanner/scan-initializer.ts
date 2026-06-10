// @ts-nocheck
import fs from 'fs';
const createScanInitializer = ({
  coverFolderDir,
  createSchema,
  createUser,
  hashPassword,
  addMainLog,
  fileSystem = fs,
  consoleLogger = console,
  exit = code => process.exit(code),
}) => {
  const ensureCoverFolder = () => {
    if (fileSystem.existsSync(coverFolderDir)) {
      return;
    }

    try {
      fileSystem.mkdirSync(coverFolderDir, { recursive: true });
    } catch (err) {
      consoleLogger.error(` ! 在创建存放音声封面图片的文件夹时出错: ${err.message}`);
      addMainLog({
        level: 'error',
        message: `在创建存放音声封面图片的文件夹时出错: ${err.message}`,
      });
      return exit(1);
    }
  };

  const createDefaultAdmin = async () => {
    try {
      await createUser({
        name: 'admin',
        password: hashPassword('admin'),
        group: 'administrator',
      });
    } catch (err) {
      if (err.message.indexOf('已存在') === -1) {
        consoleLogger.error(` ! 在创建 admin 账号时出错: ${err.message}`);
        addMainLog({
          level: 'error',
          message: `在创建 admin 账号时出错: ${err.message}`,
        });
        return exit(1);
      }
    }
  };

  const initializeScan = () => {
    ensureCoverFolder();
    return createSchema().then(createDefaultAdmin);
  };

  return {
    createDefaultAdmin,
    ensureCoverFolder,
    initializeScan,
  };
};

export { createScanInitializer };
