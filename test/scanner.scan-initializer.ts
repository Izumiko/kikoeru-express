import { expect } from 'vitest';
import { createScanInitializer } from '../src/modules/scanner/support/scan-initializer.js';

describe('createScanInitializer', () => {
  let calls;

  beforeEach(() => {
    calls = {
      mkdirs: [],
      schemas: 0,
      users: [],
      mainLogs: [],
      consoleErrors: [],
      exits: [],
    };
  });

  const createInitializer = options =>
    createScanInitializer({
      coverFolderDir: '/covers',
      createSchema: () => {
        calls.schemas += 1;
        return options.schemaError ? Promise.reject(options.schemaError) : Promise.resolve();
      },
      createUser: user => {
        calls.users.push(user);
        return options.userError ? Promise.reject(options.userError) : Promise.resolve();
      },
      hashPassword: password => `hashed-${password}`,
      addMainLog: log => calls.mainLogs.push(log),
      fileSystem: {
        existsSync: () => options.coverExists,
        mkdirSync: (folder, mkdirOptions) => {
          calls.mkdirs.push({ folder, mkdirOptions });
          if (options.mkdirError) {
            throw options.mkdirError;
          }
        },
      },
      consoleLogger: {
        error: message => calls.consoleErrors.push(message),
      },
      exit: code => calls.exits.push(code),
    });

  it('does not create the cover folder when it already exists', () => {
    const { ensureCoverFolder } = createInitializer({ coverExists: true });

    ensureCoverFolder();

    expect(calls.mkdirs).to.deep.equal([]);
  });

  it('creates the cover folder recursively when missing', () => {
    const { ensureCoverFolder } = createInitializer({ coverExists: false });

    ensureCoverFolder();

    expect(calls.mkdirs).to.deep.equal([
      {
        folder: '/covers',
        mkdirOptions: { recursive: true },
      },
    ]);
  });

  it('logs and exits when the cover folder cannot be created', () => {
    const { ensureCoverFolder } = createInitializer({
      coverExists: false,
      mkdirError: new Error('permission denied'),
    });

    ensureCoverFolder();

    expect(calls.exits).to.deep.equal([1]);
    expect(calls.consoleErrors).to.deep.equal([' ! 在创建存放音声封面图片的文件夹时出错: permission denied']);
    expect(calls.mainLogs).to.deep.equal([
      {
        level: 'error',
        message: '在创建存放音声封面图片的文件夹时出错: permission denied',
      },
    ]);
  });

  it('creates the default admin after schema initialization', async () => {
    const { initializeScan } = createInitializer({ coverExists: true });

    await initializeScan();

    expect(calls.schemas).to.equal(1);
    expect(calls.users).to.deep.equal([
      {
        name: 'admin',
        password: 'hashed-admin',
        group: 'administrator',
      },
    ]);
  });

  it('ignores the legacy admin already exists error', async () => {
    const { createDefaultAdmin } = createInitializer({
      coverExists: true,
      userError: new Error('用户已存在'),
    });

    await createDefaultAdmin();

    expect(calls.exits).to.deep.equal([]);
    expect(calls.mainLogs).to.deep.equal([]);
  });

  it('logs and exits when default admin creation fails unexpectedly', async () => {
    const { createDefaultAdmin } = createInitializer({
      coverExists: true,
      userError: new Error('database failure'),
    });

    await createDefaultAdmin();

    expect(calls.exits).to.deep.equal([1]);
    expect(calls.consoleErrors).to.deep.equal([' ! 在创建 admin 账号时出错: database failure']);
    expect(calls.mainLogs).to.deep.equal([
      {
        level: 'error',
        message: '在创建 admin 账号时出错: database failure',
      },
    ]);
  });
});
