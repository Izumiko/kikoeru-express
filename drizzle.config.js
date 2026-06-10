const { defineConfig } = require('drizzle-kit');

module.exports = defineConfig({
  dialect: 'sqlite',
  schema: './src/database/schema/tables.js',
  out: './src/database/drizzle',
  migrations: {
    table: '__drizzle_migrations',
  },
});
