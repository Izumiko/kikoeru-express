import path from 'path';
const getRuntimeBaseDir = (projectRoot: string): string =>
  process.env.KIKOERU_RUNTIME_DIR ? path.resolve(process.env.KIKOERU_RUNTIME_DIR) : projectRoot;

const getConfigFolderDir = (projectRoot: string): string => path.join(getRuntimeBaseDir(projectRoot), 'config');

const getDefaultCoverFolderDir = (projectRoot: string): string => path.join(getRuntimeBaseDir(projectRoot), 'covers');

const getDefaultDatabaseFolderDir = (projectRoot: string): string => path.join(getRuntimeBaseDir(projectRoot), 'sqlite');

const getVoiceWorkDefaultPath = (projectRoot: string): string => {
  if (process.env.IS_DOCKER) {
    return '/usr/src/kikoeru/VoiceWork';
  }

  return path.join(getRuntimeBaseDir(projectRoot), 'VoiceWork');
};

const resolveRuntimePath = (projectRoot: string, value: string): string => {
  if (path.isAbsolute(value)) {
    return value;
  }

  return path.join(getRuntimeBaseDir(projectRoot), value);
};

export {
  getConfigFolderDir,
  getDefaultCoverFolderDir,
  getDefaultDatabaseFolderDir,
  getRuntimeBaseDir,
  getVoiceWorkDefaultPath,
  resolveRuntimePath,
};
