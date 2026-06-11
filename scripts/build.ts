import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(rootDir, 'build');

const pjson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as { version: string };

const entries = {
  server: path.join(rootDir, 'src/cli/server.ts'),
  scanner: path.join(rootDir, 'src/cli/scanner.ts'),
  updater: path.join(rootDir, 'src/cli/updater.ts'),
};

const copyIfExists = (from: string, to: string): void => {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true });
};

async function build(): Promise<void> {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  await esbuild.build({
    entryPoints: entries,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outdir: buildDir,
    splitting: true,
    external: [
      '@libsql/darwin-arm64',
      '@libsql/linux-arm64-gnu',
      '@libsql/linux-arm64-musl',
      '@libsql/darwin-x64',
      '@libsql/win32-x64-msvc',
      '@libsql/linux-x64-gnu',
      '@libsql/linux-x64-musl',
      '@libsql/linux-arm-gnueabihf',
      '@libsql/linux-arm-musleabihf',
    ],
    alias: {
      emitter: 'events',
    },
    banner: {
      js: `
import { createRequire as __createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __dirnamePath } from 'path';

const require = __createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirnamePath(__filename);
      `.trim(),
    },
    logLevel: 'info',
    minify: true,
    sourcemap: true,
    define: {
      __APP_VERSION__: JSON.stringify(pjson.version),
    },
  });

  copyIfExists(path.join(rootDir, 'dist'), path.join(buildDir, 'dist'));
  copyIfExists(path.join(rootDir, 'static'), path.join(buildDir, 'static'));
  copyIfExists(path.join(rootDir, 'src/database/schema/migrations'), path.join(buildDir, 'migrations'));
}

build().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
