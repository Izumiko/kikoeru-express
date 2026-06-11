const formatRjCode = (id: number | string): string => {
  const numericId = Number(id);
  if (numericId < 1000000) {
    return `000000${numericId}`.slice(-6);
  } else if (numericId < 100000000) {
    return `00000000${numericId}`.slice(-8);
  } else {
    const str = `${numericId}`;
    if (str.length % 2 === 0) {
      return str;
    } else {
      return `0${str}`;
    }
  }
};

export { formatRjCode };
