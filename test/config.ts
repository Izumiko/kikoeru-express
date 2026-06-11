import { expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createConfigStore, versionWithoutVerTracking } from '../src/config/loader.js';

const createTempProjectRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kikoeru-config-test-'));

describe('Config store', function () {
  let oldFreezeConfigFile;
  let oldNodeEnv;
  let oldIsDocker;
  let tempRoots;

  beforeEach(function () {
    oldFreezeConfigFile = process.env.FREEZE_CONFIG_FILE;
    oldNodeEnv = process.env.NODE_ENV;
    oldIsDocker = process.env.IS_DOCKER;
    delete process.env.FREEZE_CONFIG_FILE;
    delete process.env.IS_DOCKER;
        tempRoots = [];
  });

  afterEach(function () {
    if (oldFreezeConfigFile === undefined) {
      delete process.env.FREEZE_CONFIG_FILE;
    } else {
      process.env.FREEZE_CONFIG_FILE = oldFreezeConfigFile;
    }

    if (oldNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = oldNodeEnv;
    }

    if (oldIsDocker === undefined) {
      delete process.env.IS_DOCKER;
    } else {
      process.env.IS_DOCKER = oldIsDocker;
    }

    tempRoots.forEach(root => {
      fs.rmSync(root, { recursive: true, force: true });
    });
  });

  const createStore = version => {
    const projectRoot = createTempProjectRoot();
    tempRoots.push(projectRoot);
    return createConfigStore({ projectRoot, version: version || '0.7.1' });
  };

  it('initializes default config in memory when config file writes are frozen', function () {
    process.env.FREEZE_CONFIG_FILE = 'true';
    const store = createStore();

    store.initialize();

    expect(store.config.version).to.equal('0.7.1');
    expect(store.config.auth).to.equal(false);
    expect(store.config.rewindSeekTime).to.equal(5);
    expect(fs.existsSync(store.configPath)).to.equal(false);
  });

  it('fills missing values and resolves relative configured paths', function () {
    const store = createStore();
    fs.mkdirSync(store.configFolderDir, { recursive: true });
    fs.writeFileSync(
      store.configPath,
      JSON.stringify({
        coverFolderDir: 'relative-covers',
        databaseFolderDir: 'relative-sqlite',
        coverUseDefaultPath: false,
        dbUseDefaultPath: false,
        production: false,
        auth: false,
        md5secret: 'md5',
        jwtsecret: 'jwt',
      })
    );

    store.initialize();

    expect(store.config.version).to.equal(versionWithoutVerTracking);
    expect(store.config.coverFolderDir).to.equal(path.join(path.dirname(store.configFolderDir), 'relative-covers'));
    expect(store.config.databaseFolderDir).to.equal(path.join(path.dirname(store.configFolderDir), 'relative-sqlite'));
    expect(store.config.pageSize).to.equal(12);
  });

  it('uses default database and cover directories when override flags are enabled', function () {
    const store = createStore();
    const projectRoot = path.dirname(store.configFolderDir);
    fs.mkdirSync(store.configFolderDir, { recursive: true });
    fs.writeFileSync(
      store.configPath,
      JSON.stringify({
        version: '0.7.1',
        coverFolderDir: 'ignored-covers',
        databaseFolderDir: 'ignored-sqlite',
        coverUseDefaultPath: true,
        dbUseDefaultPath: true,
        production: false,
        auth: false,
        md5secret: 'md5',
        jwtsecret: 'jwt',
      })
    );

    store.initialize();

    expect(store.config.coverFolderDir).to.equal(path.join(projectRoot, 'covers'));
    expect(store.config.databaseFolderDir).to.equal(path.join(projectRoot, 'sqlite'));
  });

  it('preserves protected config fields on setConfig', function () {
    const store = createStore();
    store.initConfig(false);
    const md5secret = store.config.md5secret;
    const jwtsecret = store.config.jwtsecret;
    store.config.production = true;
    store.config.auth = true;

    store.setConfig(
      {
        production: false,
        auth: false,
        md5secret: 'changed-md5',
        jwtsecret: 'changed-jwt',
        rewindSeekTime: 9,
      },
      false
    );

    expect(store.config.production).to.equal(true);
    expect(store.config.auth).to.equal(true);
    expect(store.config.md5secret).to.equal(md5secret);
    expect(store.config.jwtsecret).to.equal(jwtsecret);
    expect(store.sharedConfigHandle.export()).to.deep.equal({
      rewindSeekTime: 9,
      forwardSeekTime: 30,
    });
  });
});
