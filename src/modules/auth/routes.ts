import express from 'express';
import type { Request, Response } from 'express';
import { check, validationResult } from 'express-validator'; // 后端校验
import { expressjwt as expressJwt } from 'express-jwt'; // 把 JWT 的 payload 部分赋值于 req.auth

import db from '../../database.js';
import { getRouteJwtOptions, hashPassword, shouldUpgradePasswordHash, signToken, verifyPassword } from './service.js';

import { config } from '../../config/index.js';
import type { AuthUser } from './service.js';

const router = express.Router();

type AuthenticatedRequest = Request & {
  auth?: AuthUser;
};

// 用户登录
router.post(
  '/me',
  [
    check('name').isLength({ min: 5 }).withMessage('用户名长度至少为 5'),
    check('password').isLength({ min: 5 }).withMessage('密码长度至少为 5'),
  ],
  (req: Request, res: Response /*, next */) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).send({ errors: errors.array() });
    }

    const name = req.body.name;
    const password = req.body.password;

    db.getUserByName(name)
      .then((user) => {
        if (!user || !verifyPassword(password, user.password)) {
          res.set('WWW-Authenticate', 'Bearer realm="Authorization Required"');
          res.status(401).send({ error: '用户名或密码错误.' });
        } else {
          const token = signToken(user);
          if (shouldUpgradePasswordHash(user.password)) {
            db.updateUserPassword(user, hashPassword(password)).catch((err) => console.error(err));
          }
          res.send({ token });
        }
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send({ error: '服务器错误' });
        // next(err);
      });
  }
);

if (config.auth) {
  router.get('/me', expressJwt(getRouteJwtOptions()));
}

// 获取用户信息

router.get('/me', (req: AuthenticatedRequest, res: Response, _next) => {
  // 同时告诉客户端，服务器是否启用用户验证
  const auth = config.auth;
  const user = config.auth
    ? { name: req.auth?.name, group: req.auth?.group }
    : { name: 'admin', group: 'administrator' };
  res.send({ user, auth });
});

export default router;
