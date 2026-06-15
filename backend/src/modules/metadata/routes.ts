import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { param, query } from 'express-validator';
import db from '../../database.js';
import { config } from '../../config/index.js';
import { formatRjCode } from '../media/rj-code.js';
import { getTrackList } from '../media/tracks.js';
import { toTree } from '../media/tree.js';
import normalize, { type StaticMetadataRecord } from '../../shared/metadata/normalize.js';
import { isValidRequest } from '../../shared/http/validate.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE_SIZE = config.pageSize || 12;
const METADATA_FIELD_WORK_ROUTES = ['/circles/:id/works', '/tags/:id/works', '/vas/:id/works'];
const METADATA_LOOKUP_ROUTES = ['/circles/:id', '/tags/:id', '/vas/:id'];
const METADATA_LABEL_ROUTES = ['/circles', '/tags', '/vas', '/circles/', '/tags/', '/vas/'];
const WORK_ORDER_FIELDS = new Set([
  'id',
  'title',
  'release',
  'dl_count',
  'price',
  'review_count',
  'rate_count',
  'rate_average_2dp',
  'random',
]);

const getUsername = (req: Request) => (config.auth ? (req as Request & { user: { name: string } }).user.name : 'admin');
const getMetadataField = (req: Request) => req.path.split('/')[1].replace(/s$/, '');

const getMetadataIds = (req: Request) => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  return getMetadataField(req) === 'tag' || getMetadataField(req) === 'circle'
    ? idParam
        .split(',')
        .map((id: string) => parseInt(id.trim()))
        .filter((id: number) => !isNaN(id))
    : idParam.split(',');
};

const compareValues = <T>(left: T, right: T, sort: string) => {
  if (left === right) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;

  const direction = sort === 'asc' ? 1 : -1;
  return left > right ? direction : -direction;
};

const sortWorks = (works: unknown[], order: string, sort: string, shuffleSeed: number) => {
  if (!WORK_ORDER_FIELDS.has(order)) {
    order = 'release';
  }

  if (order === 'random') {
    return works.sort(
      (left: unknown, right: unknown) =>
        ((left as { id: number }).id % shuffleSeed) - ((right as { id: number }).id % shuffleSeed)
    );
  }

  return works.sort((left: unknown, right: unknown) => {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const primary = compareValues(leftRecord[order], rightRecord[order], sort);
    if (primary !== 0) return primary;

    const release = compareValues(leftRecord.release, rightRecord.release, 'desc');
    if (release !== 0) return release;

    return compareValues(leftRecord.id, rightRecord.id, 'desc');
  });
};

const sendPaginatedWorks = async (
  res: Response,
  queryFactory: () => Promise<unknown[]>,
  currentPage: number,
  pageSize: number,
  order: string,
  sort: string,
  shuffleSeed: number,
  betterRandom: boolean
) => {
  const offset = (currentPage - 1) * pageSize;
  const allWorks = await queryFactory();
  const totalCount = allWorks.length;
  let works = [...allWorks];

  if (order === 'random') {
    works = sortWorks(works, order, sort, shuffleSeed).slice(offset, offset + pageSize);
  } else if (betterRandom && order === 'betterRandom') {
    works = works.length > 0 ? [works[Math.floor(Math.random() * works.length)]] : [];
  } else {
    works = sortWorks(works, order, sort, shuffleSeed).slice(offset, offset + pageSize);
  }

  works = normalize(works as StaticMetadataRecord[]);

  res.send({
    works,
    pagination: {
      currentPage,
      pageSize,
      totalCount,
    },
  });
};

router.get('/cover/:id', param('id').isInt(), (req: Request, res: Response, next: NextFunction) => {
  if (!isValidRequest(req, res)) return;

  const rjcode = formatRjCode(Number(req.params.id));
  const type = (req.query.type as string) || 'main';
  res.sendFile(path.join(config.coverFolderDir, `RJ${rjcode}_img_${type}.jpg`), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, '../../../../static/no-image.jpg'), (err2) => {
        if (err2) {
          next(err2);
        }
      });
    }
  });
});

router.get('/work/:id', param('id').isInt(), (req: Request, res: Response, next: NextFunction) => {
  if (!isValidRequest(req, res)) return;

  db.getWorkMetadata(Number(req.params.id), getUsername(req))
    .then((work) => {
      normalize(work as unknown as StaticMetadataRecord[]);
      res.send(work[0]);
    })
    .catch((err) => next(err));
});

router.get('/tracks/:id', param('id').isInt(), (req: Request, res: Response, next: NextFunction) => {
  if (!isValidRequest(req, res)) return;

  db.getWorkTrackMetadata(Number(req.params.id))
    .then((work) => {
      const rootFolder = config.rootFolders.find((rootFolder) => rootFolder.name === work.root_folder);
      if (rootFolder) {
        getTrackList(Number(req.params.id), path.join(rootFolder.path, work.dir))
          .then((tracks) => res.send(toTree(tracks, work.title, work.dir, rootFolder)))
          .catch(() => res.status(500).send({ error: '获取文件列表失败，请检查文件是否存在或重新扫描清理' }));
      } else {
        res.status(500).send({ error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.` });
      }
    })
    .catch((err) => next(err));
});

router.get(
  '/works',
  query('page').optional({ nullable: true }).isInt(),
  query('sort').optional({ nullable: true }).isIn(['desc', 'asc']),
  query('seed').optional({ nullable: true }).isInt(),
  async (req: Request, res: Response) => {
    if (!isValidRequest(req, res)) return;

    const currentPage = parseInt(req.query.page as string) || 1;
    const order = (req.query.order as string) || 'release';
    const sort = (req.query.sort as string) || 'desc';
    const username = getUsername(req);
    const shuffleSeed = req.query.seed ? parseInt(req.query.seed as string) : 7;

    try {
      await sendPaginatedWorks(
        res,
        () => db.getWorksBy({ username }),
        currentPage,
        PAGE_SIZE,
        order,
        sort,
        shuffleSeed,
        true
      );
    } catch (err) {
      res.status(500).send({ error: '服务器错误' });
      console.error(err);
    }
  }
);

router.get(METADATA_LOOKUP_ROUTES, (req: Request, res: Response, next: NextFunction) => {
  if (!isValidRequest(req, res)) return;

  const ids = getMetadataIds(req);
  const field = getMetadataField(req) as 'circle' | 'tag' | 'va';

  return db
    .getMetadata({ field, ids })
    .then((items) => {
      if (items.every((item) => item && ids.includes(item.id as never))) {
        res.send(items);
      } else {
        const missingIds = ids.filter((id) => !items.some((item) => item && item.id === id));
        const errorMessage = {
          circle: `社团${missingIds.join(',')}不存在`,
          tag: `标签${missingIds.join(',')}不存在`,
          va: `声优${missingIds.join(',')}不存在`,
        };
        res.status(404).send({ error: errorMessage[field] });
      }
    })
    .catch((err) => next(err));
});

router.get(METADATA_FIELD_WORK_ROUTES, async (req: Request, res: Response) => {
  if (!isValidRequest(req, res)) return;

  const currentPage = parseInt(req.query.page as string) || 1;
  const order = (req.query.order as string) || 'release';
  const sort = (req.query.sort as string) || 'desc';
  const username = getUsername(req);
  const shuffleSeed = req.query.seed ? parseInt(req.query.seed as string) : 7;
  const ids = getMetadataIds(req);
  const field = getMetadataField(req) as 'circle' | 'tag' | 'va';

  try {
    await sendPaginatedWorks(
      res,
      () => db.getWorksBy({ id: ids, field, username: username }),
      currentPage,
      PAGE_SIZE,
      order,
      sort,
      shuffleSeed,
      false
    );
  } catch (err) {
    res.status(500).send({ error: '查询过程中出错' });
    console.error(err);
  }
});

router.get(METADATA_LABEL_ROUTES, (req: Request, res: Response, next: NextFunction) => {
  if (!isValidRequest(req, res)) return;

  const field = getMetadataField(req) as 'circle' | 'tag' | 'va';
  const labelsQuery = db.getLabels(field) as unknown as {
    orderBy: (field: string, sort: string) => Promise<unknown>;
  };
  labelsQuery
    .orderBy('name', 'asc')
    .then((list) => res.send(list))
    .catch((err) => next(err));
});

router.get(['/search', '/search/:keyword'], async (req: Request, res: Response) => {
  if (!isValidRequest(req, res)) return;

  const currentPage = parseInt(req.query.page as string) || 1;
  const order = (req.query.order as string) || 'release';
  const sort = (req.query.sort as string) || 'desc';
  const username = getUsername(req);
  const shuffleSeed = req.query.seed ? parseInt(req.query.seed as string) : 7;
  const keyword = req.params.keyword ? (req.params.keyword as string).trim() : '';

  try {
    await sendPaginatedWorks(
      res,
      () => db.getWorksByKeyWord({ keyword, username }),
      currentPage,
      PAGE_SIZE,
      order,
      sort,
      shuffleSeed,
      false
    );
  } catch (err) {
    res.status(500).send({ error: '查询过程中出错' });
    console.error(err);
  }
});

export default router;
