const { v5: uuidv5 } = require('uuid');

const NAME_UUID_NAMESPACE = '699d9c07-b965-4399-bafd-18a3cacf073c';

const nameToUUID = name => uuidv5(name, NAME_UUID_NAMESPACE);

const hasLetter = str => {
  for (let i in str) {
    const asc = str.charCodeAt(i);
    if ((asc >= 65 && asc <= 90) || (asc >= 97 && asc <= 122)) {
      return true;
    }
  }
  return false;
};

module.exports = {
  NAME_UUID_NAMESPACE,
  hasLetter,
  nameToUUID,
};
