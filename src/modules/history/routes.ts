import express from 'express';
import type { Request, Response } from 'express';
import { body, query } from 'express-validator';

import { config } from '../../../config.js';
import db from '../../database.js';
import { isValidRequest } from '../../shared/http/validate.js';

const router = express.Router();

type HistoryRequest = Request & {
  user?: { name: string };
};

const getUsername = (req: Request) =>
  (config.auth ? (req as HistoryRequest).user?.name : 'admin') || 'admin';

router.put(
  '/',
  body('work_id').isInt(),
  body('file_index').isInt(),
  body('file_name').optional({ nullable: true }).isString(),
  body('play_time').optional({ nullable: true }).isFloat(),
  body('total_time').optional({ nullable: true }).isFloat(),
  (req: Request, res: Response) => {
    if (!isValidRequest(req, res)) return;

    const username = getUsername(req);

    db.insertHistory({
      userName: username,
      workId: Number(req.body.work_id),
      fileIndex: String(req.body.file_index),
      fileName: req.body.file_name || null,
      playTime: req.body.play_time != null ? Number(req.body.play_time) : null,
      totalTime: req.body.total_time != null ? Number(req.body.total_time) : null,
    })
      .then(() => {
        res.send({ message: '历史记录添加成功' });
      })
      .catch((err: unknown) => {
        res.status(500).send({ error: '添加失败，服务器错误' });
        console.error(err);
      });
  }
);

router.get('/', async (req: Request, res: Response) => {
  if (!isValidRequest(req, res)) return;

  const username = getUsername(req);

  try {
    const history = await db.getHistoryByUsername(username);
    res.send(
      history.map((record) => ({
        ...record,
        work_id: Number(record.workId),
        file_index: record.fileIndex,
        file_name: record.fileName,
        play_time: record.playTime,
        total_time: record.totalTime,
        updated_at: record.updatedAt,
        user_name: record.userName,
      }))
    );
  } catch (err: unknown) {
    console.error(err);
    res.status(500).send({ error: '服务器错误' });
  }
});

router.get(
  '/getByWorkIdIndex',
  query('work_id').isInt(),
  query('file_index').isString(),
  async (req: Request, res: Response) => {
    if (!isValidRequest(req, res)) return;

    const username = getUsername(req);

    try {
      const history = await db.getHistoryByWorkIdIndex(
        username,
        Number(req.query.work_id),
        String(req.query.file_index)
      );
      res.send(
        history.map((record) => ({
          ...record,
          work_id: Number(record.workId),
          file_index: record.fileIndex,
          file_name: record.fileName,
          play_time: record.playTime,
          total_time: record.totalTime,
          updated_at: record.updatedAt,
          user_name: record.userName,
        }))
      );
    } catch (err: unknown) {
      console.error(err);
      res.status(500).send({ error: '服务器错误' });
    }
  }
);

router.get('/recent', async (req: Request, res: Response) => {
  if (!isValidRequest(req, res)) return;

  const username = getUsername(req);

  try {
    const history = await db.getHistoryGroupByWorkId(username);
    res.send(
      history.map((record) => ({
        ...record,
        work_id: Number(record.workId),
        file_index: record.fileIndex,
        file_name: record.fileName,
        play_time: record.playTime,
        total_time: record.totalTime,
        updated_at: record.updatedAt,
        user_name: record.userName,
      }))
    );
  } catch (err: unknown) {
    console.error(err);
    res.status(500).send({ error: '服务器错误' });
  }
});

export default router;
