const client = require('../src/database/client.js');
const repositories = require('../src/database/repositories');

module.exports = {
  knex: client.knex,
  databaseExist: client.databaseExist,
  ...repositories,
};
