import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

declare const __APP_VERSION__: string;

export const version = (() => {
  if (typeof __APP_VERSION__ === 'string') {
    return __APP_VERSION__;
  }
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.join(__dirname, '..');
  const pjson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as { version: string };
  return pjson.version;
})();
