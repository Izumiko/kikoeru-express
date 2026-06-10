const pjson = require('./package.json');
const { createConfigStore } = require('./src/config/loader.js');
const { getRuntimeBaseDir } = require('./src/config/paths.js');

const projectRoot = __dirname;

const store = createConfigStore({
  projectRoot,
  version: pjson.version,
});

store.initialize();

module.exports = {
  setConfig: store.setConfig,
  updateConfig: store.updateConfig,
  config: store.config,
  runtimeBaseDir: getRuntimeBaseDir(projectRoot),
  sharedConfigHandle: store.sharedConfigHandle,
  configFolderDir: store.configFolderDir,
};
