const { knex } = require('../client.js');

/**
 * 创建一个新用户
 * @param {Object} user User object.
 */
const createUser = user =>
  knex.transaction(trx =>
    trx('t_user')
      .where('name', '=', user.name)
      .first()
      .then(res => {
        if (res) {
          throw new Error(`用户 ${user.name} 已存在.`);
        }
        return trx('t_user').insert(user);
      })
  );

/**
 * 更新用户密码
 * @param {Object} user User object.
 * @param {String} newPassword new password
 */
const updateUserPassword = (user, newPassword) =>
  knex.transaction(trx =>
    trx('t_user')
      .where('name', '=', user.name)
      .first()
      .then(res => {
        if (!res) {
          throw new Error('用户名或密码错误.');
        }
        return trx('t_user').where('name', '=', user.name).update({
          password: newPassword,
        });
      })
  );

/**
 * 重置用户密码为 "password"
 * @param {Object} user User object.
 */
const resetUserPassword = user =>
  knex.transaction(trx =>
    trx('t_user')
      .where('name', '=', user.name)
      .first()
      .then(res => {
        if (!res) {
          throw new Error('用户名错误.');
        }
        return trx('t_user').where('name', '=', user.name).update({
          password: 'password',
        });
      })
  );

/**
 * 删除用户
 * @param {Object} user User object.
 */
const deleteUser = users =>
  knex.transaction(trx =>
    trx('t_user')
      .where(
        'name',
        'in',
        users.map(user => user.name)
      )
      .del()
  );

module.exports = {
  createUser,
  deleteUser,
  resetUserPassword,
  updateUserPassword,
};
