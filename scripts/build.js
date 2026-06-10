const fs = require('fs');
const path = require('path');

const esbuild = require('esbuild');

const rootDir = path.join(__dirname, '..');
const buildDir = path.join(rootDir, 'build');

const entries = {
  server: path.join(rootDir, 'src/cli/server.js'),
  scanner: path.join(rootDir, 'src/cli/scanner.js'),
  updater: path.join(rootDir, 'src/cli/updater.js'),
};

const copyIfExists = (from, to) => {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true });
};

async function build() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  await esbuild.build({
    entryPoints: entries,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outdir: buildDir,
    packages: 'external',
    logLevel: 'info',
  });

  copyIfExists(path.join(rootDir, 'dist'), path.join(buildDir, 'dist'));
  copyIfExists(path.join(rootDir, 'static'), path.join(buildDir, 'static'));
  copyIfExists(path.join(rootDir, 'src/database/schema/migrations'), path.join(buildDir, 'migrations'));
}

build().catch(error => {
  console.error(error);
  process.exit(1);
});
