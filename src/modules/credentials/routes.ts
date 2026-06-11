import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { check, validationResult } from 'express-validator'; // 后端校验

import { config } from '../../config/index.js';
import db from '../../database.js';
import { hashPassword } from '../auth/service.js';
import type { AuthUser } from '../auth/service.js';

const router = express.Router();

type UserRequest = Request & {
  user?: AuthUser;
};

type DeleteUserRequestBody = {
  users: Array<{
    name: string;
  }>;
};

const getErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

// 创建一个新用户 (只有 admin 账号拥有权限)
router.post(
  '/user',
  [
    check('name').isLength({ min: 5 }).withMessage('用户名长度至少为 5'),
    check('password').isLength({ min: 5 }).withMessage('密码长度至少为 5'),
    check('group').custom((value) => {
      if (value !== 'user' && value !== 'guest') {
        throw new Error(`用户组名称必须为 ['user', 'guest'] 的一个.`);
      }
      return true;
    }),
  ],
  (req: Request, res: Response, next: NextFunction) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).send({ errors: errors.array() });
    }

    const user = {
      name: req.body.name,
      password: req.body.password,
      group: req.body.group,
    };

    const userReq = req as UserRequest;
    if (!config.auth || userReq.user?.name === 'admin') {
      db.createUser({
        name: user.name,
        password: hashPassword(user.password),
        group: user.group,
      })
        .then(() => res.send({ message: `用户 ${user.name} 创建成功.` }))
        .catch((err: unknown) => {
          const message = getErrorMessage(err);
          if (message.indexOf('已存在') !== -1) {
            res.status(403).send({ error: message });
          } else {
            next(err);
          }
        });
    } else {
      res.status(403).send({ error: '只有 admin 账号能创建新用户.' });
    }
  }
);

// 更新用户密码
router.put(
  '/user',
  [
    check('name').isLength({ min: 5 }).withMessage('用户名长度至少为 5'),
    check('newPassword').isLength({ min: 5 }).withMessage('密码长度至少为 5'),
  ],
  (req: Request, res: Response, next: NextFunction) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const user = {
      name: req.body.name,
    };
    const newPassword = hashPassword(req.body.newPassword);

    const userReq = req as UserRequest;
    if (!config.auth || userReq.user?.name === 'admin' || userReq.user?.name === user.name) {
      db.updateUserPassword(user, newPassword)
        .then(() => res.send({ message: '密码修改成功.' }))
        .catch((err: unknown) => {
          if (getErrorMessage(err).indexOf('用户名错误.') !== -1) {
            res.status(403).send({ error: '用户名错误.' });
          } else {
            next(err);
          }
        });
    } else {
      res.status(403).send({ error: '只能修改自己账号的密码.' });
    }
  }
);

// 删除用户 (仅 admin 账号拥有权限)
router.delete('/user', (req: Request, res: Response, next: NextFunction) => {
  const { users } = req.body as DeleteUserRequestBody;
  const userReq = req as UserRequest;

  if (!config.auth || userReq.user?.name === 'admin') {
    if (!users.find((user) => user.name === 'admin')) {
      db.deleteUser(users)
        .then(() => {
          res.send({ message: '删除成功.' });
        })
        .catch((err) => {
          next(err);
        });
    } else {
      res.status(403).send({ error: '不能删除内置的管理员账号.' });
    }
  } else {
    res.status(403).send({ error: '只有 admin 账号能删除用户.' });
  }
});

// 获取所有用户
router.get('/users', (req: Request, res: Response, next: NextFunction) => {
  const userReq = req as UserRequest;
  if (!config.auth || userReq.user?.name === 'admin') {
    db.getUsers()
      .then((users) => {
        res.send({ users });
      })
      .catch((err) => {
        next(err);
      });
  } else {
    res.status(403).send({ error: '只有 admin 账号能浏览用户.' });
  }
});

export default router;
