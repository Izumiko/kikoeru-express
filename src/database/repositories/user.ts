// @ts-nocheck
import { eq, inArray } from 'drizzle-orm';

import { db } from '../client.js';
import { users } from '../schema/tables.js';

/**
 * 创建一个新用户
 * @param {Object} user User object.
 */
const createUser = user =>
  db.transaction(async tx => {
    const existing = await tx.select().from(users).where(eq(users.name, user.name)).limit(1);
    if (existing[0]) {
      throw new Error(`用户 ${user.name} 已存在.`);
    }

    await tx.insert(users).values(user);
  });

/**
 * 更新用户密码
 * @param {Object} user User object.
 * @param {String} newPassword new password
 */
const updateUserPassword = (user, newPassword) =>
  db.transaction(async tx => {
    const existing = await tx.select().from(users).where(eq(users.name, user.name)).limit(1);
    if (!existing[0]) {
      throw new Error('用户名或密码错误.');
    }

    await tx.update(users).set({ password: newPassword }).where(eq(users.name, user.name));
  });

/**
 * 重置用户密码为 "password"
 * @param {Object} user User object.
 */
const resetUserPassword = user =>
  db.transaction(async tx => {
    const existing = await tx.select().from(users).where(eq(users.name, user.name)).limit(1);
    if (!existing[0]) {
      throw new Error('用户名错误.');
    }

    await tx.update(users).set({ password: 'password' }).where(eq(users.name, user.name));
  });

/**
 * 删除用户
 * @param {Object[]} usersToDelete User objects.
 */
const deleteUser = usersToDelete =>
  db.transaction(tx => tx.delete(users).where(inArray(users.name, usersToDelete.map(user => user.name))));

/**
 * 按用户名查找用户
 * @param {String} name username
 */
const getUserByName = async name => {
  const result = await db.select().from(users).where(eq(users.name, name)).limit(1);
  return result[0];
};

/**
 * 获取所有用户的公开信息
 */
const getUsers = () => db.select({ name: users.name, group: users.group }).from(users);

export {
  createUser,
  deleteUser,
  getUserByName,
  getUsers,
  resetUserPassword,
  updateUserPassword,
};
