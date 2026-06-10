// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createConfigStore } from './src/config/loader.js';
import { getRuntimeBaseDir } from './src/config/paths.js';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const pjson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

const store = createConfigStore({
  projectRoot,
  version: pjson.version,
});

store.initialize();

export const setConfig = store.setConfig;
export const updateConfig = store.updateConfig;
export const config = store.config;
export const runtimeBaseDir = getRuntimeBaseDir(projectRoot);
export const sharedConfigHandle = store.sharedConfigHandle;
export const configFolderDir = store.configFolderDir;
