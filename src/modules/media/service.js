const fs = require('fs');
const path = require('path');
const recursiveReaddir = require('recursive-readdir');
const { orderBy } = require('natural-orderby');
const { joinFragments } = require('../../../routes/utils/url');
const { config } = require('../../../config');

const playableExtensions = new Set([
  '.mp3',
  '.ogg',
  '.opus',
  '.wav',
  '.aac',
  '.flac',
  '.webm',
  '.mp4',
  '.m4a',
  '.txt',
  '.lrc',
  '.srt',
  '.ass',
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

const textExtensions = new Set(['.txt', '.lrc', '.srt', '.ass']);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/**
 * Returns list of playable tracks in a given folder. Track is an object
 * containing 'title', 'subtitle' and 'hash'.
 * @param {Number} id Work identifier. Currently, RJ/RE code.
 * @param {String} dir Work directory (absolute).
 */
const getTrackList = (id, dir) =>
  recursiveReaddir(dir)
    .then(files => {
      const filteredFiles = files.filter(file => playableExtensions.has(path.extname(file)));

      const sortedFiles = orderBy(
        filteredFiles.map(file => {
          const shortFilePath = file.replace(path.join(dir, '/'), '');
          const dirName = path.dirname(shortFilePath);

          return {
            title: path.basename(file),
            subtitle: dirName === '.' ? null : dirName,
            ext: path.extname(file),
          };
        }),
        [v => v.subtitle, v => v.title, v => v.ext]
      );

      return sortedFiles.map((file, index) => ({
        title: file.title,
        subtitle: file.subtitle,
        hash: `${id}/${index}`,
        ext: file.ext,
      }));
    })
    .catch(err => {
      throw new Error(`Failed to get tracklist from disk: ${err}`);
    });

/**
 * 转换成树状结构
 * @param {{
 *  title: string;
 *  subtitle: string | null;
 *  hash: string;
 *  ext: string;
 *  }[]} tracks
 * @param {String} workTitle
 * @param {String} workDir
 * @param {Object} rootFolder
 * @return {Array} Tree structure of tracks.
 */
const toTree = (tracks, workTitle, workDir, rootFolder) => {
  const tree = [];

  tracks.forEach(track => {
    let fatherFolder = tree;
    const filePath = track.subtitle ? track.subtitle.split('/') : [];
    filePath.forEach(folderName => {
      const index = fatherFolder.findIndex(item => item.type === 'folder' && item.title === folderName);
      if (index === -1) {
        fatherFolder.push({
          type: 'folder',
          title: folderName,
          children: [],
        });
      }
      fatherFolder = fatherFolder.find(item => item.type === 'folder' && item.title === folderName).children;
    });
  });

  tracks.forEach(track => {
    let fatherFolder = tree;
    const paths = track.subtitle ? track.subtitle.split('/') : [];
    paths.forEach(folderName => {
      fatherFolder = fatherFolder.find(item => item.type === 'folder' && item.title === folderName).children;
    });

    let offloadStreamUrl = joinFragments(
      config.offloadStreamPath,
      rootFolder.name,
      workDir,
      track.subtitle || '',
      track.title
    );
    let offloadDownloadUrl = joinFragments(
      config.offloadDownloadPath,
      rootFolder.name,
      workDir,
      track.subtitle || '',
      track.title
    );
    if (process.platform === 'win32') {
      offloadStreamUrl = offloadStreamUrl.replace(/\\/g, '/');
      offloadDownloadUrl = offloadDownloadUrl.replace(/\\/g, '/');
    }

    const textBaseUrl = '/api/media/stream/';
    const mediaStreamBaseUrl = '/api/media/stream/';
    const mediaDownloadBaseUrl = '/api/media/download/';
    const textStreamBaseUrl = textBaseUrl + track.hash;
    const textDownloadBaseUrl = config.offloadMedia ? offloadDownloadUrl : mediaDownloadBaseUrl + track.hash;
    const mediaStreamUrl = config.offloadMedia ? offloadStreamUrl : mediaStreamBaseUrl + track.hash;
    const mediaDownloadUrl = config.offloadMedia ? offloadDownloadUrl : mediaDownloadBaseUrl + track.hash;

    if (textExtensions.has(track.ext)) {
      fatherFolder.push({
        type: 'text',
        hash: track.hash,
        title: track.title,
        workTitle,
        mediaStreamUrl: textStreamBaseUrl,
        mediaDownloadUrl: textDownloadBaseUrl,
      });
    } else if (imageExtensions.has(track.ext)) {
      fatherFolder.push({
        type: 'image',
        hash: track.hash,
        title: track.title,
        workTitle,
        mediaStreamUrl,
        mediaDownloadUrl,
      });
    } else if (track.ext === '.pdf') {
      fatherFolder.push({
        type: 'other',
        hash: track.hash,
        title: track.title,
        workTitle,
        mediaStreamUrl,
        mediaDownloadUrl,
      });
    } else {
      fatherFolder.push({
        type: 'audio',
        hash: track.hash,
        title: track.title,
        workTitle,
        mediaStreamUrl,
        mediaDownloadUrl,
      });
    }
  });

  return tree;
};

/**
 * 返回一个成员为指定根文件夹下所有包含 RJ 号的音声文件夹对象的数组，
 * 音声文件夹对象 { relativePath: '相对路径', rootFolderName: '根文件夹别名', id: '音声ID' }
 * @param {Object} rootFolder 根文件夹对象 { name: '别名', path: '绝对路径' }
 */
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

/**
 * Deletes a work's cover image from disk.
 * @param {String} rjcode Work RJ code (only the 6 digits, zero-padded).
 */
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

/**
 * Saves cover image to disk.
 * @param {ReadableStream} stream Image data stream.
 * @param {String} rjcode Work RJ code (only the 6 digits, zero-padded).
 * @param {String} types img type: ('main', 'sam', 'sam@2x', 'sam@3x', '240x240', '360x360').
 */
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

/**
 * 获取 RJ 号
 * - 初始位数少于等于 6 的, 补到 6 位
 * - 初始位数少于等于 8 的, 补到 8 位
 * - 对于更高的位数, 如果为奇数位, 则补一个 0
 * - 如果为偶数位, 则补不补
 * @param {number} id Work id.
 * @returns {string} RJ code.
 */
const formatRjCode = id => {
  if (id < 1000000) {
    return `000000${id}`.slice(-6);
  } else if (id < 100000000) {
    return `00000000${id}`.slice(-8);
  } else {
    const str = `${id}`;
    if (str.length % 2 === 0) {
      return str;
    } else {
      return `0${str}`;
    }
  }
};

module.exports = {
  getTrackList,
  toTree,
  getFolderList,
  deleteCoverImageFromDisk,
  saveCoverImageToDisk,
  formatRjCode,
};
