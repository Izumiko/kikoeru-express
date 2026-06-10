const withTransaction = async (client, callback) => {
  await client.execute('BEGIN');
  try {
    const result = await callback();
    await client.execute('COMMIT');
    return result;
  } catch (error) {
    await client.execute('ROLLBACK');
    throw error;
  }
};

const createUserRepository = client => {
  const createUser = user =>
    withTransaction(client, async () => {
      const existing = await client.execute({
        sql: 'SELECT * FROM t_user WHERE name = ?',
        args: [user.name],
      });
      if (existing.rows[0]) {
        throw new Error(`用户 ${user.name} 已存在.`);
      }

      await client.execute({
        sql: 'INSERT INTO t_user(name, password, "group") VALUES (?, ?, ?)',
        args: [user.name, user.password, user.group],
      });
    });

  const updateUserPassword = (user, newPassword) =>
    withTransaction(client, async () => {
      const existing = await client.execute({
        sql: 'SELECT * FROM t_user WHERE name = ?',
        args: [user.name],
      });
      if (!existing.rows[0]) {
        throw new Error('用户名或密码错误.');
      }

      await client.execute({
        sql: 'UPDATE t_user SET password = ? WHERE name = ?',
        args: [newPassword, user.name],
      });
    });

  const resetUserPassword = user =>
    withTransaction(client, async () => {
      const existing = await client.execute({
        sql: 'SELECT * FROM t_user WHERE name = ?',
        args: [user.name],
      });
      if (!existing.rows[0]) {
        throw new Error('用户名错误.');
      }

      await client.execute({
        sql: 'UPDATE t_user SET password = ? WHERE name = ?',
        args: ['password', user.name],
      });
    });

  const deleteUser = users =>
    withTransaction(client, () =>
      client.execute({
        sql: `DELETE FROM t_user WHERE name IN (${users.map(() => '?').join(', ')})`,
        args: users.map(user => user.name),
      })
    );

  return {
    createUser,
    deleteUser,
    resetUserPassword,
    updateUserPassword,
  };
};

module.exports = {
  createUserRepository,
};
