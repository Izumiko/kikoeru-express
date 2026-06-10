const path = require('path');

const getRuntimeBaseDir = projectRoot =>
  process.env.KIKOERU_RUNTIME_DIR ? path.resolve(process.env.KIKOERU_RUNTIME_DIR) : projectRoot;

const getConfigFolderDir = projectRoot => path.join(getRuntimeBaseDir(projectRoot), 'config');

const getDefaultCoverFolderDir = projectRoot => path.join(getRuntimeBaseDir(projectRoot), 'covers');

const getDefaultDatabaseFolderDir = projectRoot => path.join(getRuntimeBaseDir(projectRoot), 'sqlite');

const getVoiceWorkDefaultPath = projectRoot => {
  if (process.env.IS_DOCKER) {
    return '/usr/src/kikoeru/VoiceWork';
  }

  return path.join(getRuntimeBaseDir(projectRoot), 'VoiceWork');
};

const resolveRuntimePath = (projectRoot, value) => {
  if (path.isAbsolute(value)) {
    return value;
  }

  return path.join(getRuntimeBaseDir(projectRoot), value);
};

module.exports = {
  getConfigFolderDir,
  getDefaultCoverFolderDir,
  getDefaultDatabaseFolderDir,
  getRuntimeBaseDir,
  getVoiceWorkDefaultPath,
  resolveRuntimePath,
};
