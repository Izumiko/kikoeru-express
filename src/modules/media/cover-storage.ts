// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { config } from '../../../config.js';

const deleteCoverImageFromDisk = rjcode =>
  new Promise((resolve, reject) => {
    const types = ['main', 'sam', '240x240', '360x360'];
    types.forEach(type => {
      try {
        fs.unlinkSync(path.join(config.coverFolderDir, `RJ${rjcode}_img_${type}.jpg`));
      } catch (err) {
        reject(err);
      }
    });

    resolve();
  });

const saveCoverImageToDisk = (stream, rjcode, type) =>
  new Promise((resolve, reject) => {
    try {
      stream.pipe(
        fs
          .createWriteStream(path.join(config.coverFolderDir, `RJ${rjcode}_img_${type}.jpg`))
          .on('close', () => resolve())
      );
    } catch (err) {
      reject(err);
    }
  });

export {
  deleteCoverImageFromDisk,
  saveCoverImageToDisk,
};
