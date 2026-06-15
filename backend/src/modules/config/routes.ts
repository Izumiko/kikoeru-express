import express from 'express';
import type { Request } from 'express';
import { config, setConfig, sharedConfigHandle } from '../../config/index.js';
import type { AppConfig } from '../../config/types.js';
import type { AuthUser } from '../auth/service.js';

const router = express.Router();

type ConfigFilterMode = 'read' | 'write';

type UserRequest = Request & {
  user?: AuthUser;
};

type AdminConfigRequestBody = {
  config?: Partial<AppConfig>;
};

const filterConfig = (_config: Partial<AppConfig>, option: ConfigFilterMode = 'read'): Partial<AppConfig> => {
  const currentConfig = config;
  const configClone = structuredClone(_config);
  delete (configClone as Record<string, unknown>).md5secret;
  delete (configClone as Record<string, unknown>).jwtsecret;
  if (option === 'write') {
    delete (configClone as Record<string, unknown>).production;
    if (process.env.NODE_ENV === 'production' || currentConfig.production) {
      delete (configClone as Record<string, unknown>).auth;
    }
  }
  return configClone;
};

// 修改配置文件
router.put('/admin', (req, res, next) => {
  const userReq = req as UserRequest;
  if (!config.auth || userReq.user?.name === 'admin') {
    try {
      // Note: setConfig uses Object.assign to merge new configs
      const body = req.body as AdminConfigRequestBody;
      setConfig(filterConfig(body.config || {}, 'write'));
      res.send({ message: '保存成功.' });
    } catch (err) {
      next(err);
    }
  } else {
    res.status(403).send({ error: '只有 admin 账号能修改配置文件.' });
  }
});

// 获取配置文件
router.get('/admin', (req, res, next) => {
  const userReq = req as UserRequest;
  if (!config.auth || userReq.user?.name === 'admin') {
    try {
      res.send({ config: filterConfig(config, 'read') });
    } catch (err) {
      next(err);
    }
  } else {
    res.status(403).send({ error: '只有 admin 账号能读取管理配置文件.' });
  }
});

router.get('/shared', (req, res, next) => {
  try {
    res.send({ sharedConfig: sharedConfigHandle.export() });
  } catch (err) {
    next(err);
  }
});

export {
  filterConfig,
  router,
};

export default router;
