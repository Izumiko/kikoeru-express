// @ts-nocheck
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

export { formatRjCode };
