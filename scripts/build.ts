import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(rootDir, 'build');

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
    packages: 'external',
    logLevel: 'info',
  });

  copyIfExists(path.join(rootDir, 'dist'), path.join(buildDir, 'dist'));
  copyIfExists(path.join(rootDir, 'static'), path.join(buildDir, 'static'));
  copyIfExists(path.join(rootDir, 'src/database/schema/migrations'), path.join(buildDir, 'migrations'));
}

build().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
