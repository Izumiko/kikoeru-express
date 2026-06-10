const { databaseExist } = require('./client');
const repositories = require('./repositories');

module.exports = {
  databaseExist,
  ...repositories,
};
