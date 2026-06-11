import fs from 'fs';
import type { ScannerLog } from '../../media/folder-scanner.js';

type CreateUserInput = {
  name: string;
  password: string;
  group: string;
};

type ScanInitializerOptions = {
  coverFolderDir: string;
  createSchema: () => Promise<void>;
  createUser: (user: CreateUserInput) => Promise<unknown>;
  hashPassword: (password: string) => string;
  addMainLog: (log: ScannerLog) => void;
  fileSystem?: Pick<typeof fs, 'existsSync' | 'mkdirSync'>;
  consoleLogger?: Pick<Console, 'error'>;
  exit?: (code: number) => void;
};

const getErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const createScanInitializer = ({
  coverFolderDir,
  createSchema,
  createUser,
  hashPassword,
  addMainLog,
  fileSystem = fs,
  consoleLogger = console,
  exit = code => process.exit(code),
}: ScanInitializerOptions) => {
  const ensureCoverFolder = (): void => {
    if (fileSystem.existsSync(coverFolderDir)) {
      return;
    }

    try {
      fileSystem.mkdirSync(coverFolderDir, { recursive: true });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      consoleLogger.error(` ! 在创建存放音声封面图片的文件夹时出错: ${message}`);
      addMainLog({
        level: 'error',
        message: `在创建存放音声封面图片的文件夹时出错: ${message}`,
      });
      exit(1);
    }
  };

  const createDefaultAdmin = async (): Promise<void> => {
    try {
      await createUser({
        name: 'admin',
        password: hashPassword('admin'),
        group: 'administrator',
      });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      if (message.indexOf('已存在') === -1) {
        consoleLogger.error(` ! 在创建 admin 账号时出错: ${message}`);
        addMainLog({
          level: 'error',
          message: `在创建 admin 账号时出错: ${message}`,
        });
        exit(1);
      }
    }
  };

  const initializeScan = (): Promise<void> => {
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
