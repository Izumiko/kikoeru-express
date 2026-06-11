import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { query, body } from 'express-validator';
import type { StaticMetadataRecord } from '../../shared/metadata/normalize.js';

import { config } from '../../../config.js';
import db from '../../database.js';
import normalize from '../../shared/metadata/normalize.js';
import { isValidRequest } from '../../shared/http/validate.js';

const router = express.Router();
const PAGE_SIZE = config.pageSize || 12;

type ReviewRequest = Request & {
  user?: { name: string };
};

router.get(
  '/',
  query('page').optional({ nullable: true }).isInt(),
  query('sort').optional({ nullable: true }).isIn(['desc', 'asc']),
  query('seed').optional({ nullable: true }).isInt(),
  query('filter').optional({ nullable: true }).isIn(['marked', 'listening', 'listened', 'replay', 'postponed']),
   
  async (req: Request, res: Response) => {
    if (!isValidRequest(req, res)) return;

    const currentPage = parseInt(req.query.page as string) || 1;
    // 通过 "音声id, 贩卖日, 评价, 用户评价, 售出数, 评论数量, 价格, 平均评价, 全年龄新作" 排序
    // ['id', 'release', 'rating', 'dl_count', 'review_count', 'price', 'rate_average_2dp, nsfw']
    const order = (req.query.order as string) || 'release';
    const sort = (req.query.sort as string) || 'desc';
    const offset = (currentPage - 1) * PAGE_SIZE;
    const username = (config.auth ? (req as ReviewRequest).user?.name : 'admin') || 'admin';
    const filter = req.query.filter as string | undefined;

    try {
      const { works, totalCount } = await db.getWorksWithReviews({
        username: username,
        limit: PAGE_SIZE,
        offset: offset,
        orderBy: order,
        sortOption: sort,
        filter,
      });

      normalize(works as unknown as StaticMetadataRecord[], { dateOnly: true });

      res.send({
        works,
        pagination: {
          currentPage,
          pageSize: PAGE_SIZE,
          totalCount: totalCount[0]['count'],
        },
      });
    } catch (err) {
      res.status(500).send({ error: '查询过程中出错' });
      console.error(err);
    }
  }
);

// 提交用户评价
router.put(
  '/',
  body('work_id').isInt(),
  body('rating').optional({ nullable: true }).isInt(),
  body('progress').optional({ nullable: true }).isIn(['marked', 'listening', 'listened', 'replay', 'postponed']),
  body('starOnly').optional({ nullable: true }).isBoolean(),
  body('progressOnly').optional({ nullable: true }).isBoolean(),
   
  (req: Request, res: Response) => {
    if (!isValidRequest(req, res)) return;

    const username = (config.auth ? (req as ReviewRequest).user?.name : 'admin') || 'admin';
    let starOnly = true;
    let progressOnly = false;
    if (req.query.starOnly === 'false') {
      starOnly = false;
    }
    if (req.query.progressOnly === 'true') {
      progressOnly = true;
    }

    db.updateUserReview(
      username,
      req.body.work_id,
      req.body.rating,
      req.body.review_text,
      req.body.progress,
      starOnly,
      progressOnly
    )
      .then(() => {
        if (progressOnly) {
          res.send({ message: '更新进度成功' });
        } else {
          res.send({ message: '评价成功' });
        }
      })
      .catch(err => {
        res.status(500).send({ error: '评价失败，服务器错误' });
        console.error(err);
      });
  }
);

// 删除用户标记
router.delete('/', query('work_id').isInt(), (req: Request, res: Response, next: NextFunction) => {
  if (!isValidRequest(req, res)) return;

  const username = (config.auth ? (req as ReviewRequest).user?.name : 'admin') || 'admin';
  db.deleteUserReview(username, req.query.work_id as string)
    .then(() => {
      res.send({ message: '删除标记成功' });
    })
    .catch(err => next(err));
});

export default router;
