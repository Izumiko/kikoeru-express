import fs from 'fs/promises';
import path from 'path';

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

export type Track = {
  title: string;
  subtitle: string | null;
  hash: string;
  ext: string;
};

type FileItem = Omit<Track, 'hash'>;

type RecursiveDirent = {
  name: string;
  isFile(): boolean;
  parentPath?: string;
  path?: string;
};

const getDirentParentPath = (dirent: RecursiveDirent): string => dirent.parentPath || dirent.path || '';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const getTrackList = async (id: number | string, dir: string): Promise<Track[]> => {
  try {
    // 1. 使用原生 API 递归读取目录（Node.js 20+）
    const dirents = await fs.readdir(dir, { recursive: true, withFileTypes: true });

    // 2. 使用 reduce 替代 filter + map 组合，减少一次数组遍历，提升性能
    const fileItems = (dirents as unknown as RecursiveDirent[]).reduce<FileItem[]>((acc, dirent) => {
      // 过滤掉目录或符号链接，只保留真实文件
      if (!dirent.isFile()) return acc;

      const title = String(dirent.name);
      const ext = path.extname(title);
      if (!playableExtensions.has(ext)) return acc;

      // 获取文件所在的目录路径 (Node 20+ 使用 dirent.path，Node 21.2+ 推荐 dirent.parentPath)
      const dirPath = getDirentParentPath(dirent);

      // 计算相对路径。如果与根目录一致，relativeDir 为 ''
      const relativeDir = path.relative(dir, dirPath).replace(/\\/g, '/');

      acc.push({
        title,
        subtitle: relativeDir === '' ? null : relativeDir,
        ext: ext,
      });

      return acc;
    }, []);

    // 3. 排序
    const sortedFiles = fileItems.sort((a, b) => {
      const subtitleCompare =
        a.subtitle === null && b.subtitle !== null
          ? 1
          : a.subtitle !== null && b.subtitle === null
            ? -1
            : collator.compare(a.subtitle ?? '', b.subtitle ?? '');
      if (subtitleCompare !== 0) return subtitleCompare;
      const titleCompare = collator.compare(a.title, b.title);
      if (titleCompare !== 0) return titleCompare;
      return collator.compare(a.ext, b.ext);
    });

    // 4. 返回最终结果
    return sortedFiles.map((file, index) => ({
      title: file.title,
      subtitle: file.subtitle,
      hash: `${id}/${index}`,
      ext: file.ext,
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const error = new Error(`Failed to get tracklist from disk: ${message}`);
    (error as Error & { cause?: unknown }).cause = err;
    throw error;
  }
};

export { getTrackList };
