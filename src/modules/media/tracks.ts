// @ts-nocheck
import fs from 'fs/promises';
import path from 'path';
import { orderBy } from 'natural-orderby';

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

const getTrackList = async (id, dir) => {
  try {
    // 1. 使用原生 API 递归读取目录（Node.js 20+）
    const dirents = await fs.readdir(dir, { recursive: true, withFileTypes: true });

    // 2. 使用 reduce 替代 filter + map 组合，减少一次数组遍历，提升性能
    const fileItems = dirents.reduce((acc, dirent) => {
      // 过滤掉目录或符号链接，只保留真实文件
      if (!dirent.isFile()) return acc;

      const ext = path.extname(dirent.name);
      if (!playableExtensions.has(ext)) return acc;

      // 获取文件所在的目录路径 (Node 20+ 使用 dirent.path，Node 21.2+ 推荐 dirent.parentPath)
      const dirPath = dirent.parentPath || dirent.path; 

      // 计算相对路径。如果与根目录一致，relativeDir 为 ''
      const relativeDir = path.relative(dir, dirPath).replace(/\\/g, '/');

      acc.push({
        title: dirent.name,
        subtitle: relativeDir === '' ? null : relativeDir,
        ext: ext,
      });

      return acc;
    }, []);

    // 3. 排序
    const sortedFiles = orderBy(
      fileItems,
      [v => v.subtitle, v => v.title, v => v.ext]
    );

    // 4. 返回最终结果
    return sortedFiles.map((file, index) => ({
      title: file.title,
      subtitle: file.subtitle,
      hash: `${id}/${index}`,
      ext: file.ext,
    }));
  } catch (err) {
    throw new Error(`Failed to get tracklist from disk: ${err.message}`, { cause: err });
  }
};

export { getTrackList };
