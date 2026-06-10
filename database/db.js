const { databaseExist } = require('../src/database/libsql-client.js');
const repositories = require('../src/database/repositories');

let knexOverride;

module.exports = {
  get knex() {
    if (knexOverride) return knexOverride;
    return require('../src/database/client.js').knex;
  },
  set knex(value) {
    knexOverride = value;
  },
  databaseExist,
  ...repositories,
};
