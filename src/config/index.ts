import path from 'path';
import { fileURLToPath } from 'url';
import { createConfigStore } from './loader.js';
import { getRuntimeBaseDir } from './paths.js';
import type { AppConfig } from './types.js';
import { version } from '../version.js';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const store = createConfigStore({
  projectRoot,
  version,
});

store.initialize();

export const setConfig = store.setConfig;
export const updateConfig = store.updateConfig;
export const config: AppConfig = store.config;
export const runtimeBaseDir = getRuntimeBaseDir(projectRoot);
export const sharedConfigHandle = store.sharedConfigHandle;
export const configFolderDir = store.configFolderDir;
