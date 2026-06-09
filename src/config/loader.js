const fs = require('fs');
const path = require('path');
const compareVersions = require('compare-versions');

const { createDefaultConfig } = require('./defaults.js');
const {
  getConfigFolderDir,
  getDefaultCoverFolderDir,
  getDefaultDatabaseFolderDir,
  resolveRuntimePath,
} = require('./paths.js');

// Before the following version, there is no version tracking
const versionWithoutVerTracking = '0.4.1';
// Before the following version, db path is using the absolute path in databaseFolderDir of config.json
const versionDbRelativePath = '0.5.8';

const createConfigStore = ({ projectRoot, version }) => {
  const configFolderDir = getConfigFolderDir(projectRoot);
  const configPath = path.join(configFolderDir, 'config.json');
  const defaultConfig = createDefaultConfig({ projectRoot, version });
  const config = {};

  const replaceConfig = nextConfig => {
    Object.keys(config).forEach(key => delete config[key]);
    Object.assign(config, nextConfig);
  };

  const initConfig = (writeConfigToFile = !process.env.FREEZE_CONFIG_FILE) => {
    Object.assign(config, defaultConfig);
    if (writeConfigToFile) {
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, '\t'));
    }
  };

  const setConfig = (newConfig, writeConfigToFile = !process.env.FREEZE_CONFIG_FILE) => {
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
  const readConfig = () => {
    replaceConfig(JSON.parse(fs.readFileSync(configPath)));
    for (let key in defaultConfig) {
      if (!config.hasOwnProperty(key)) {
        if (key === 'version') {
          config[key] = versionWithoutVerTracking;
        } else {
          config[key] = defaultConfig[key];
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
  const updateConfig = (writeConfigToFile = !process.env.FREEZE_CONFIG_FILE) => {
    let cfg = JSON.parse(fs.readFileSync(configPath));
    let countChanged = 0;
    for (let key in defaultConfig) {
      if (!cfg.hasOwnProperty(key)) {
        console.log('写入设置', key);
        cfg[key] = defaultConfig[key];
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

  class publicConfig {
    get rewindSeekTime() {
      return config.rewindSeekTime;
    }
    get forwardSeekTime() {
      return config.forwardSeekTime;
    }
    export() {
      return {
        rewindSeekTime: this.rewindSeekTime,
        forwardSeekTime: this.forwardSeekTime,
      };
    }
  }

  const sharedConfigHandle = new publicConfig();

  const initialize = () => {
    // This part runs when the module is initialized
    // TODO: refactor global side effect
    if (!fs.existsSync(configPath)) {
      if (!fs.existsSync(configFolderDir)) {
        try {
          fs.mkdirSync(configFolderDir, { recursive: true });
        } catch (err) {
          console.error(` ! 在创建存放配置文件的文件夹时出错: ${err.message}`);
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

module.exports = {
  createConfigStore,
  versionDbRelativePath,
  versionWithoutVerTracking,
};
