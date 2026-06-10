// @ts-nocheck
/**
 * 通过数组中每个对象的 id 属性去重。
 * 返回的 duplicate 以 id 为键，值为被跳过的重复项数组。
 */
const dedupeFoldersById = folders => {
  const uniqueArr = [];
  const duplicate = {};

  for (let i = 0; i < folders.length; i++) {
    for (let j = i + 1; j < folders.length; j++) {
      if (folders[i].id === folders[j].id) {
        duplicate[folders[i].id] = duplicate[folders[i].id] || [];
        duplicate[folders[i].id].push(folders[i]);
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
