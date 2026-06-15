import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/database/schema/tables.ts',
  out: './src/database/schema/migrations',
  migrations: {
    table: '__drizzle_migrations',
  },
});
