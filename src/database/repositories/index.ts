// @ts-nocheck
import * as metadata from './metadata.js';
import * as review from './review.js';
import * as user from './user.js';
import * as work from './work.js';

export * from './metadata.js';
export * from './review.js';
export * from './user.js';
export * from './work.js';

export default {
  ...metadata,
  ...review,
  ...user,
  ...work,
};
