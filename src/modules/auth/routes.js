const express = require('express');
const { check, validationResult } = require('express-validator'); // 后端校验
const { expressjwt: expressJwt } = require('express-jwt'); // 把 JWT 的 payload 部分赋值于 req.auth

const db = require('../../../database/db');
const {
  getRouteJwtOptions,
  hashPassword,
  shouldUpgradePasswordHash,
  signToken,
  verifyPassword,
} = require('./service.js');

const { config } = require('../../../config');

const router = express.Router();

// 用户登录
router.post(
  '/me',
  [
    check('name').isLength({ min: 5 }).withMessage('用户名长度至少为 5'),
    check('password').isLength({ min: 5 }).withMessage('密码长度至少为 5'),
  ],
  (req, res /*, next */) => {
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).send({ errors: errors.array() });
    }

    const name = req.body.name;
    const password = req.body.password;

    db.knex('t_user')
      .where('name', '=', name)
      .first()
      .then(user => {
        if (!user || !verifyPassword(password, user.password)) {
          res.set('WWW-Authenticate', 'Bearer realm="Authorization Required"');
          res.status(401).send({ error: '用户名或密码错误.' });
        } else {
          const token = signToken(user);
          if (shouldUpgradePasswordHash(user.password)) {
            db.updateUserPassword(user, hashPassword(password)).catch(err => console.error(err));
          }
          res.send({ token });
        }
      })
      .catch(err => {
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
// eslint-disable-next-line no-unused-vars
router.get('/me', (req, res, next) => {
  // 同时告诉客户端，服务器是否启用用户验证
  const auth = config.auth;
  const user = config.auth ? { name: req.auth.name, group: req.auth.group } : { name: 'admin', group: 'administrator' };
  res.send({ user, auth });
});

module.exports = router;
