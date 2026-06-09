/* eslint-disable node/no-unpublished-require */
const pjson = require('./package.json');
const { createConfigStore } = require('./src/config/loader.js');

const store = createConfigStore({
  projectRoot: __dirname,
  version: pjson.version,
});

store.initialize();

module.exports = {
  setConfig: store.setConfig,
  updateConfig: store.updateConfig,
  config: store.config,
  sharedConfigHandle: store.sharedConfigHandle,
  configFolderDir: store.configFolderDir,
};
