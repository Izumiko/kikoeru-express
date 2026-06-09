const path = require('path');
const recursiveReaddir = require('recursive-readdir');
const { orderBy } = require('natural-orderby');

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

module.exports = { getTrackList };
