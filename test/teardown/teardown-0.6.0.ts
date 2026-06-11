import { libsql } from '../../src/database/client.js';

const dropDatabase = async () => {
  await libsql.execute('DROP VIEW IF EXISTS userMetadata');
  await libsql.execute('DROP VIEW IF EXISTS staticMetadata');
  await libsql.execute('DROP TABLE IF EXISTS __drizzle_migrations');
  await libsql.execute('DROP TABLE IF EXISTS r_tag_work');
  await libsql.execute('DROP TABLE IF EXISTS r_va_work');
  await libsql.execute('DROP TABLE IF EXISTS t_review');
  await libsql.execute('DROP TABLE IF EXISTS t_work');
  await libsql.execute('DROP TABLE IF EXISTS t_tag');
  await libsql.execute('DROP TABLE IF EXISTS t_va');
  await libsql.execute('DROP TABLE IF EXISTS t_circle');
  await libsql.execute('DROP TABLE IF EXISTS t_user');
};

export { dropDatabase };
