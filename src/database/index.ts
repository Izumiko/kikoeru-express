// @ts-nocheck
import { databaseExist } from './client.js';
import * as repositories from './repositories/index.js';

export { databaseExist };
export * from './repositories/index.js';

export default {
  databaseExist,
  ...repositories,
};
