import { v5 as uuidv5 } from 'uuid';

const NAME_UUID_NAMESPACE = '699d9c07-b965-4399-bafd-18a3cacf073c';

const nameToUUID = (name: string): string => uuidv5(name, NAME_UUID_NAMESPACE);

const hasLetter = (str: string): boolean => {
  for (let i = 0; i < str.length; i += 1) {
    const asc = str.charCodeAt(i);
    if ((asc >= 65 && asc <= 90) || (asc >= 97 && asc <= 122)) {
      return true;
    }
  }
  return false;
};

export {
  NAME_UUID_NAMESPACE,
  hasLetter,
  nameToUUID,
};
