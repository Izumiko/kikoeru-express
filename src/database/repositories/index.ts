import * as history from './history.js';
import * as metadata from './metadata.js';
import * as review from './review.js';
import * as user from './user.js';
import * as work from './work.js';

export * from './history.js';
export * from './metadata.js';
export * from './review.js';
export * from './user.js';
export * from './work.js';

export default {
  ...history,
  ...metadata,
  ...review,
  ...user,
  ...work,
};
