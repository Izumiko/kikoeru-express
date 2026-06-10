import fs from 'fs';
import path from 'path';
import compareVersions from 'compare-versions';
import type { AppConfig, ConfigStore, PublicConfigSnapshot } from './types.js';
import { createDefaultConfig } from './defaults.js';
import {
  getConfigFolderDir,
  getDefaultCoverFolderDir,
  getDefaultDatabaseFolderDir,
  resolveRuntimePath,
} from './paths.js';

// Before the following version, there is no version tracking
const versionWithoutVerTracking = '0.4.1';
// Before the following version, db path is using the absolute path in databaseFolderDir of config.json
const versionDbRelativePath = '0.5.8';

const hasOwn = (target: object, key: string): boolean => Object.prototype.hasOwnProperty.call(target, key);

const readConfigFile = (configPath: string): Partial<AppConfig> =>
  JSON.parse(fs.readFileSync(configPath, 'utf8')) as Partial<AppConfig>;

const assignConfigKey = (target: Partial<AppConfig>, key: keyof AppConfig, value: AppConfig[keyof AppConfig]): void => {
  (target as Record<keyof AppConfig, AppConfig[keyof AppConfig]>)[key] = value;
};

const createConfigStore = ({ projectRoot, version }: { projectRoot: string; version: string }): ConfigStore => {
  const configFolderDir = getConfigFolderDir(projectRoot);
  const configPath = path.join(configFolderDir, 'config.json');
  const defaultConfig = createDefaultConfig({ projectRoot, version });
  const config = {} as AppConfig;

  const replaceConfig = (nextConfig: Partial<AppConfig>) => {
    Object.keys(config).forEach(key => delete config[key]);
    Object.assign(config, nextConfig);
  };

  const initConfig = (writeConfigToFile = !process.env.FREEZE_CONFIG_FILE): void => {
    Object.assign(config, defaultConfig);
    if (writeConfigToFile) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, '\t'));
    }
  };

  const setConfig = (newConfig: Partial<AppConfig>, writeConfigToFile = !process.env.FREEZE_CONFIG_FILE): void => {
    // Prevent changing some values, overwrite with old ones
    newConfig.production = config.production;
    if (process.env.NODE_ENV === 'production' || config.production) {
      newConfig.auth = true;
    }
    newConfig.md5secret = config.md5secret;
    newConfig.jwtsecret = config.jwtsecret;

    // Merge config
    Object.assign(config, newConfig);
    if (writeConfigToFile) {
      fs.writeFileSync(configPath, JSON.stringify(config, null, '\t'));
    }
  };

  // Get or use default value
  const readConfig = (): void => {
    replaceConfig(readConfigFile(configPath));
    for (const key of Object.keys(defaultConfig) as Array<keyof AppConfig>) {
      if (!hasOwn(config, key)) {
        if (key === 'version') {
          assignConfigKey(config, key, versionWithoutVerTracking);
        } else {
          assignConfigKey(config, key, defaultConfig[key]);
        }
      }
    }

    // Support reading relative path
    // When config is saved in admin panel, it will still be stored as absolute path
    config.coverFolderDir = resolveRuntimePath(projectRoot, config.coverFolderDir);
    config.databaseFolderDir = resolveRuntimePath(projectRoot, config.databaseFolderDir);

    // Use ./covers and ./sqlite to override settings, ignoring corresponding fields in config
    if (config.coverUseDefaultPath) {
      config.coverFolderDir = getDefaultCoverFolderDir(projectRoot);
    }
    if (config.dbUseDefaultPath) {
      config.databaseFolderDir = getDefaultDatabaseFolderDir(projectRoot);
    }

    if (process.env.NODE_ENV === 'production' || config.production) {
      config.auth = true;
      config.production = true;
    }
  };

  // Migrate config
  const updateConfig = (writeConfigToFile = !process.env.FREEZE_CONFIG_FILE): void => {
    const cfg = readConfigFile(configPath);
    let countChanged = 0;
    for (const key of Object.keys(defaultConfig) as Array<keyof AppConfig>) {
      if (!hasOwn(cfg, key)) {
        console.log('写入设置', key);
        assignConfigKey(cfg, key, defaultConfig[key]);
        countChanged += 1;
      }
    }

    if (compareVersions.compare(cfg.version, versionDbRelativePath, '<')) {
      console.log('数据库位置已设置为程序目录下的sqlite文件夹');
      console.log('如需指定其它位置，请阅读0.6.0-rc.0更新说明');
    }

    if (countChanged || cfg.version !== version) {
      cfg.version = version;
      setConfig(cfg, writeConfigToFile);
    }
  };

  class PublicConfig {
    get rewindSeekTime() {
      return config.rewindSeekTime;
    }
    get forwardSeekTime() {
      return config.forwardSeekTime;
    }
    export(): PublicConfigSnapshot {
      return {
        rewindSeekTime: this.rewindSeekTime,
        forwardSeekTime: this.forwardSeekTime,
      };
    }
  }

  const sharedConfigHandle = new PublicConfig();

  const initialize = (): void => {
    // This part runs when the module is initialized
    // TODO: refactor global side effect
    if (!fs.existsSync(configPath)) {
      if (!fs.existsSync(configFolderDir)) {
        try {
          fs.mkdirSync(configFolderDir, { recursive: true });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(` ! 在创建存放配置文件的文件夹时出错: ${message}`);
        }
      }
      const writeConfigToFile = !process.env.FREEZE_CONFIG_FILE;
      initConfig(writeConfigToFile);
    } else {
      readConfig();
    }
  };

  return {
    config,
    configFolderDir,
    configPath,
    defaultConfig,
    initialize,
    initConfig,
    readConfig,
    setConfig,
    sharedConfigHandle,
    updateConfig,
  };
};

export {
  createConfigStore,
  versionDbRelativePath,
  versionWithoutVerTracking,
};
