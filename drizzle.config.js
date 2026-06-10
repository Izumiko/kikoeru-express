const { defineConfig } = require('drizzle-kit');

module.exports = defineConfig({
  dialect: 'sqlite',
  schema: './src/database/schema/tables.js',
  out: './src/database/schema/migrations',
  migrations: {
    table: '__drizzle_migrations',
  },
});
