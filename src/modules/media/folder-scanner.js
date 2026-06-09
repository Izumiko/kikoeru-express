const fs = require('fs');
const path = require('path');
const { config } = require('../../../config');

async function* getFolderList(rootFolder, current = '', depth = 0, callback = function addMainLog() {}) {
  const folders = await fs.promises.readdir(path.join(rootFolder.path, current));

  for (const folder of folders) {
    const absolutePath = path.resolve(rootFolder.path, current, folder);
    const relativePath = path.join(current, folder);

    try {
      // eslint-disable-next-line no-await-in-loop
      if ((await fs.promises.stat(absolutePath)).isDirectory()) {
        if (folder.match(/RJ\d+/)) {
          yield {
            absolutePath,
            relativePath,
            rootFolderName: rootFolder.name,
            id: parseInt(folder.match(/RJ(\d+)/)[1]),
          };
        } else if (depth + 1 < config.scannerMaxRecursionDepth) {
          yield* getFolderList(rootFolder, relativePath, depth + 1);
        }
      }
    } catch (err) {
      if (err.code === 'EPERM') {
        if (err.path && !err.path.endsWith('System Volume Information')) {
          console.log(' ! 无法访问', err.path);
          callback({
            level: 'info',
            message: ` ! 无法访问 ${err.path}`,
          });
        }
      } else {
        throw err;
      }
    }
  }
}

module.exports = { getFolderList };
