const path = require('path');
const express = require('express');
const { param, query } = require('express-validator');
const db = require('../../../database/db');
const { config } = require('../../../config');
const { formatRjCode } = require('../media/rj-code');
const { getTrackList } = require('../media/tracks');
const { toTree } = require('../media/tree');
const normalize = require('../../shared/metadata/normalize');
const { isValidRequest } = require('../../shared/http/validate');

const router = express.Router();
const PAGE_SIZE = config.pageSize || 12;

const getUsername = req => (config.auth ? req.user.name : 'admin');

const getMetadataIds = req =>
  req.params.field === 'tag' || req.params.field === 'circle'
    ? req.params.id
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id))
    : req.params.id.split(',');

const sendPaginatedWorks = async (res, queryFactory, currentPage, pageSize, order, sort, shuffleSeed, betterRandom) => {
  const offset = (currentPage - 1) * pageSize;
  const totalCount = await queryFactory().count('id as count');

  let works = null;

  if (order === 'random') {
    works = await queryFactory().offset(offset).limit(pageSize).orderBy(db.knex.raw('id % ?', shuffleSeed));
  } else if (betterRandom && order === 'betterRandom') {
    works = await queryFactory().limit(1).orderBy(db.knex.raw('random()'));
  } else {
    works = await queryFactory()
      .offset(offset)
      .limit(pageSize)
      .orderBy(order, sort)
      .orderBy([
        { column: 'release', order: 'desc' },
        { column: 'id', order: 'desc' },
      ]);
  }

  works = normalize(works);

  res.send({
    works,
    pagination: {
      currentPage,
      pageSize,
      totalCount: totalCount[0]['count'],
    },
  });
};

router.get('/cover/:id', param('id').isInt(), (req, res, next) => {
  if (!isValidRequest(req, res)) return;

  const rjcode = formatRjCode(req.params.id);
  const type = req.query.type || 'main';
  res.sendFile(path.join(config.coverFolderDir, `RJ${rjcode}_img_${type}.jpg`), err => {
    if (err) {
      res.sendFile(path.join(__dirname, '../../../static/no-image.jpg'), err2 => {
        if (err2) {
          next(err2);
        }
      });
    }
  });
});

router.get('/work/:id', param('id').isInt(), (req, res, next) => {
  if (!isValidRequest(req, res)) return;

  db.getWorkMetadata(req.params.id, getUsername(req))
    .then(work => {
      normalize(work);
      res.send(work[0]);
    })
    .catch(err => next(err));
});

router.get('/tracks/:id', param('id').isInt(), (req, res, next) => {
  if (!isValidRequest(req, res)) return;

  db.knex('t_work')
    .select('title', 'root_folder', 'dir')
    .where('id', '=', req.params.id)
    .first()
    .then(work => {
      const rootFolder = config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
      if (rootFolder) {
        getTrackList(req.params.id, path.join(rootFolder.path, work.dir))
          .then(tracks => res.send(toTree(tracks, work.title, work.dir, rootFolder)))
          .catch(() => res.status(500).send({ error: '获取文件列表失败，请检查文件是否存在或重新扫描清理' }));
      } else {
        res.status(500).send({ error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.` });
      }
    })
    .catch(err => next(err));
});

router.get(
  '/works',
  query('page').optional({ nullable: true }).isInt(),
  query('sort').optional({ nullable: true }).isIn(['desc', 'asc']),
  query('seed').optional({ nullable: true }).isInt(),
  async (req, res) => {
    if (!isValidRequest(req, res)) return;

    const currentPage = parseInt(req.query.page) || 1;
    const order = req.query.order || 'release';
    const sort = req.query.sort || 'desc';
    const username = getUsername(req);
    const shuffleSeed = req.query.seed ? req.query.seed : 7;

    try {
      await sendPaginatedWorks(
        res,
        () => db.getWorksBy({ username: username }),
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

router.get('/:field(circle|tag|va)s/:id', param('field').isIn(['circle', 'tag', 'va']), (req, res, next) => {
  if (!isValidRequest(req, res)) return;

  const ids = getMetadataIds(req);

  return db
    .getMetadata({
      field: req.params.field,
      ids,
    })
    .then(items => {
      if (items.every(item => item && ids.includes(item.id))) {
        res.send(items);
      } else {
        const errorMessage = {
          circle: `社团${ids.filter(id => !items.some(item => item && item.id === id)).join(',')}不存在`,
          tag: `标签${ids.filter(id => !items.some(item => item && item.id === id)).join(',')}不存在`,
          va: `声优${ids.filter(id => !items.some(item => item && item.id === id)).join(',')}不存在`,
        };
        res.status(404).send({ error: errorMessage[req.params.field] });
      }
    })
    .catch(err => next(err));
});

router.get('/search/:keyword?', async (req, res) => {
  const keyword = req.params.keyword ? req.params.keyword.trim() : '';
  const currentPage = parseInt(req.query.page) || 1;
  const order = req.query.order || 'release';
  const sort = req.query.sort || 'desc';
  const username = getUsername(req);
  const shuffleSeed = req.query.seed ? req.query.seed : 7;

  try {
    await sendPaginatedWorks(
      res,
      () => db.getWorksByKeyWord({ keyword: keyword, username: username }),
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

router.get(
  '/:field(circle|tag|va)s/:id/works',
  param('field').isIn(['circle', 'tag', 'va']),
  async (req, res) => {
    if (!isValidRequest(req, res)) return;

    const currentPage = parseInt(req.query.page) || 1;
    const order = req.query.order || 'release';
    const sort = req.query.sort || 'desc';
    const username = getUsername(req);
    const shuffleSeed = req.query.seed ? req.query.seed : 7;
    const ids = getMetadataIds(req);

    try {
      await sendPaginatedWorks(
        res,
        () => db.getWorksBy({ id: ids, field: req.params.field, username: username }),
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
  }
);

router.get('/:field(circle|tag|va)s/', param('field').isIn(['circle', 'tag', 'va']), (req, res, next) => {
  if (!isValidRequest(req, res)) return;

  db.getLabels(req.params.field)
    .orderBy('name', 'asc')
    .then(list => res.send(list))
    .catch(err => next(err));
});

module.exports = router;
