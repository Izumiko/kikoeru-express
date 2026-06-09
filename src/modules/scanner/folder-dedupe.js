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

module.exports = { dedupeFoldersById };
