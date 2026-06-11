import type { WorkFolder } from '../../media/folder-scanner.js';

type DedupeFoldersResult<T extends { id: number | string }> = {
  uniqueArr: T[];
  duplicate: Record<string, T[]>;
};

/**
 * 通过数组中每个对象的 id 属性去重。
 * 返回的 duplicate 以 id 为键，值为被跳过的重复项数组。
 */
const dedupeFoldersById = <T extends Pick<WorkFolder, 'id'>>(folders: T[]): DedupeFoldersResult<T> => {
  const uniqueArr: T[] = [];
  const duplicate: Record<string, T[]> = {};

  for (let i = 0; i < folders.length; i++) {
    for (let j = i + 1; j < folders.length; j++) {
      if (folders[i].id === folders[j].id) {
        const id = String(folders[i].id);
        duplicate[id] = duplicate[id] || [];
        duplicate[id].push(folders[i]);
        ++i;
      }
    }
    uniqueArr.push(folders[i]);
  }

  return {
    uniqueArr,
    duplicate,
  };
};

export { dedupeFoldersById };
