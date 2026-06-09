const fs = require('fs');
const path = require('path');
const LimitPromise = require('limit-promise'); // 限制并发数量

const axios = require('../scraper/axios.js'); // 数据请求
const { scrapeWorkMetadataFromDLsite, scrapeDynamicWorkMetadataFromDLsite } = require('../scraper/dlsite');
const db = require('../database/db');
const { createSchema } = require('../database/schema');
const { deleteCoverImageFromDisk, saveCoverImageToDisk } = require('../src/modules/media/cover-storage');
const { getFolderList } = require('../src/modules/media/folder-scanner');
const { formatRjCode } = require('../src/modules/media/rj-code');
const { md5 } = require('../auth/utils');
const { nameToUUID } = require('../scraper/utils');

const { config } = require('../config');
const { updateLock } = require('../upgrade');
const { createCoverDownloader } = require('../src/modules/scanner/cover-downloader');
const { ScanCounters, createScanFinishedMessage, createUpdateFinishedMessage } = require('../src/modules/scanner/counters');
const { dedupeFoldersById } = require('../src/modules/scanner/folder-dedupe');
const { ScannerLifecycle } = require('../src/modules/scanner/lifecycle');
const { ScannerLogger } = require('../src/modules/scanner/logger');
const { ScanSession } = require('../src/modules/scanner/session');
const { createWorkProcessor } = require('../src/modules/scanner/work-processor');

// 只有在子进程中 process 对象才有 send() 方法
process.send = process.send || function () {};

const scanSession = new ScanSession(event => process.send(event));
const scannerLogger = new ScannerLogger(scanSession);
const scannerLifecycle = new ScannerLifecycle({
  send: event => process.send(event),
  destroyDatabase: () => db.knex.destroy(),
  exit: code => process.exit(code),
});
const tasks = scanSession.tasks;

const addTask = rjcode => scanSession.addTask(rjcode);
const removeTask = rjcode => scanSession.removeTask(rjcode);
const addLogForTask = (rjcode, log) => scanSession.addLogForTask(rjcode, log);
const addResult = (rjcode, result, count) => scanSession.addResult(rjcode, result, count);
const addMainLog = log => scanSession.addMainLog(log);
const { getCoverImage } = createCoverDownloader({
  axios,
  saveCoverImageToDisk,
  addLogForTask,
});

const emitMainLog = (message, level = 'info', truncate = 3) => scannerLogger.emitMainLog(message, level, truncate);
const emitTaskLog = (message, rjcode, level = 'info', truncate = 15) =>
  scannerLogger.emitTaskLog(message, rjcode, level, truncate);

process.on('message', m => {
  if (m.emit === 'SCAN_INIT_STATE') {
    scanSession.emitInitState();
  } else if (m.exit) {
    console.error(' ! 终止扫描进程.');
    addMainLog({
      level: 'error',
      message: '终止扫描进程.',
    });

    process.exit(1);
  }
});

/**
 * 从 DLsite 抓取该音声的元数据，并保存到数据库，
 * 返回一个 Promise 对象，处理结果: 'added' or 'failed'
 * @param {number} id work id
 * @param {string} rootFolderName 根文件夹别名
 * @param {string} dir 音声文件夹相对路径
 * @param {string} tagLanguage 标签语言，'ja-jp', 'zh-tw' or 'zh-cn'，默认'zh-cn'
 */
const getMetadata = (id, rootFolderName, dir, tagLanguage) => {
  const rjcode = formatRjCode(id); // zero-pad to 6 digits
  console.log(` -> [RJ${rjcode}] 从 DLSite 抓取元数据...`);
  addLogForTask(rjcode, {
    level: 'info',
    message: '从 DLSite 抓取元数据...',
  });

  return scrapeWorkMetadataFromDLsite(id, tagLanguage) // 抓取该音声的元数据
    .then(metadata => {
      // 将抓取到的元数据插入到数据库
      console.log(` -> [RJ${rjcode}] 元数据抓取成功，准备添加到数据库...`);
      addLogForTask(rjcode, {
        level: 'info',
        message: '元数据抓取成功，准备添加到数据库...',
      });

      metadata.rootFolderName = rootFolderName;
      metadata.dir = dir;
      return db
        .insertWorkMetadata(metadata)
        .then(() => {
          console.log(` -> [RJ${rjcode}] 元数据成功添加到数据库.`);
          addLogForTask(rjcode, {
            level: 'info',
            message: '元数据成功添加到数据库.',
          });

          return 'added';
        })
        .catch(err => {
          console.error(`  ! [RJ${rjcode}] 在插入元数据过程中出错: ${err.message}`);
          addLogForTask(rjcode, {
            level: 'error',
            message: `在插入元数据过程中出错: ${err.message}`,
          });

          return 'failed';
        });
    })
    .catch(err => {
      console.error(`  ! [RJ${rjcode}] 在抓取元数据过程中出错: ${err.message}`);
      addLogForTask(rjcode, {
        level: 'error',
        message: `在抓取元数据过程中出错: ${err.message}`,
      });

      return 'failed';
    });
};

const { processFolder } = createWorkProcessor({
  knex: db.knex,
  coverFolderDir: config.coverFolderDir,
  tagLanguage: config.tagLanguage,
  getMetadata,
  getCoverImage,
  addTask,
  addLogForTask,
});

const MAX = config.maxParallelism; // 并发请求上限
const limitP = new LimitPromise(MAX); // 核心控制器
/**
 * 限制 processFolder 并发数量，
 * 使用控制器包装 processFolder 方法，实际上是将请求函数递交给控制器处理
 */
const processFolderLimited = folder => {
  return limitP.call(processFolder, folder);
};

/**
 * 清理本地不再存在的音声: 将其元数据从数据库中移除，并删除其封面图片
 */
const performCleanup = async () => {
  const trxProvider = db.knex.transactionProvider();
  const trx = await trxProvider();
  const works = await trx('t_work').select('id', 'root_folder', 'dir');
  const promises = works.map(
    work =>
      new Promise((resolve, reject) => {
        // 检查每个音声的根文件夹或本地路径是否仍然存在
        const rootFolder = config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);
        if (!rootFolder || !fs.existsSync(path.join(rootFolder.path, work.dir))) {
          db.removeWork(work.id, trxProvider) // 将其数据项从数据库中移除
            .then(result => {
              // 然后删除其封面图片
              const rjcode = formatRjCode(work.id);
              deleteCoverImageFromDisk(rjcode)
                .catch(err => {
                  if (err && err.code !== 'ENOENT') {
                    console.error(`  ! [RJ${rjcode}] 在删除封面过程中出错: ${err.message}`);
                    addMainLog({
                      level: 'error',
                      message: `[RJ${rjcode}] 在删除封面过程中出错: ${err.message}`,
                    });
                  }
                })
                .then(() => resolve(result));
            })
            .catch(err => reject(err));
        } else {
          resolve();
        }
      })
  );

  await Promise.all(promises);
  trx.commit();
};

/**
 * 执行扫描
 * createCoverFolder => createSchema => cleanup => getAllFolderList => processAllFolder
 */
const performScan = () => {
  if (!fs.existsSync(config.coverFolderDir)) {
    try {
      fs.mkdirSync(config.coverFolderDir, { recursive: true });
    } catch (err) {
      console.error(` ! 在创建存放音声封面图片的文件夹时出错: ${err.message}`);
      addMainLog({
        level: 'error',
        message: `在创建存放音声封面图片的文件夹时出错: ${err.message}`,
      });
      process.exit(1);
    }
  }

  return createSchema() // 构建数据库结构
    .then(async () => {
      try {
        // 创建内置的管理员账号
        await db.createUser({
          name: 'admin',
          password: md5('admin'),
          group: 'administrator',
        });
      } catch (err) {
        if (err.message.indexOf('已存在') === -1) {
          console.error(` ! 在创建 admin 账号时出错: ${err.message}`);
          addMainLog({
            level: 'error',
            message: `在创建 admin 账号时出错: ${err.message}`,
          });

          process.exit(1);
        }
      }

      const counts = new ScanCounters();

      // Fix hash collision bug in t_va
      // Scan to repopulate the Voice Actor data for those problematic works
      // かの仔 and こっこ
      let fixVAFailed = false;
      if (updateLock.isLockFilePresent && updateLock.lockFileConfig.fixVA) {
        emitMainLog(' * 开始进行声优元数据修复，需要联网');
        try {
          const updateResult = await fixVoiceActorBug();
          counts.increment('updated', updateResult);
          updateLock.removeLockFile();
          emitMainLog(' * 完成元数据修复');
        } catch (err) {
          emitMainLog(err.toString(), 'error');
          fixVAFailed = true;
        }
      }

      if (config.skipCleanup) {
        console.log(' * 根据设置跳过清理.');
      } else {
        try {
          console.log(' * 清理本地不再存在的音声的数据与封面图片...');
          addMainLog({
            level: 'info',
            message: '清理本地不再存在的音声的数据与封面图片...',
          });

          await performCleanup();

          console.log(' * 清理完成. 现在开始扫描...');
          addMainLog({
            level: 'info',
            message: '清理完成. 现在开始扫描...',
          });
        } catch (err) {
          console.error(` ! 在执行清理过程中出错: ${err.message}`);
          addMainLog({
            level: 'error',
            message: `在执行清理过程中出错: ${err.message}`,
          });

          process.exit(1);
        }
      }

      let folderList = [];
      try {
        for (const rootFolder of config.rootFolders) {
          for await (const folder of getFolderList(rootFolder, '', 0, addMainLog)) {
            folderList.push(folder);
          }
        }

        console.log(` * 共找到 ${folderList.length} 个音声文件夹.`);
        addMainLog({
          level: 'info',
          message: `共找到 ${folderList.length} 个音声文件夹.`,
        });
      } catch (err) {
        console.error(` ! 在扫描根文件夹的过程中出错: ${err.message}`);
        addMainLog({
          level: 'error',
          message: `在扫描根文件夹的过程中出错: ${err.message}`,
        });

        process.exit(1);
      }

      try {
        // 去重，避免在之后的并行处理文件夹过程中，出现对数据库同时写入同一条记录的错误
        const dedupedFolders = dedupeFoldersById(folderList);
        const uniqueFolderList = dedupedFolders.uniqueArr;
        const duplicate = dedupedFolders.duplicate;
        const duplicateNum = folderList.length - uniqueFolderList.length;

        if (duplicateNum) {
          console.log(` ! 发现 ${duplicateNum} 个重复的音声文件夹.`);
          addMainLog({
            level: 'info',
            message: `发现 ${duplicateNum} 个重复的音声文件夹.`,
          });

          for (const key in duplicate) {
            const addedFolder = uniqueFolderList.find(folder => folder.id === parseInt(key));
            duplicate[key].push(addedFolder); // 最后一项为将要添加到数据库中的音声文件夹

            const rjcode = formatRjCode(key);
            console.log(` -> [RJ${rjcode}] 存在多个文件夹:`);
            addMainLog({
              level: 'info',
              message: `[RJ${rjcode}] 存在多个文件夹:`,
            });

            // 打印音声文件夹的绝对路径
            duplicate[key].forEach(folder => {
              const rootFolder = config.rootFolders.find(rootFolder => rootFolder.name === folder.rootFolderName);
              const absolutePath = path.join(rootFolder.path, folder.relativePath);
              console.log(`   "${absolutePath}"`);
              addMainLog({
                level: 'info',
                message: `"${absolutePath}"`,
              });
            });
          }
        }

        counts.increment('skipped', duplicateNum);

        const promises = uniqueFolderList.map(folder =>
          processFolderLimited(folder).then(result => {
            // 统计处理结果
            const rjcode = formatRjCode(folder.id);
            counts.increment(result);

            if (result === 'added') {
              console.log(` -> [RJ${rjcode}] 添加成功! Added: ${counts.added}`);
              addLogForTask(rjcode, {
                level: 'info',
                message: `添加成功! Added: ${counts.added}`,
              });

              tasks.find(task => task.rjcode === rjcode).result = 'added';
              removeTask(rjcode);
              addResult(rjcode, 'added', counts.added);
            } else if (result === 'failed') {
              console.error(` -> [RJ${rjcode}] 添加失败! Failed: ${counts.failed}`);
              addLogForTask(rjcode, {
                level: 'error',
                message: `添加失败! Failed: ${counts.failed}`,
              });

              tasks.find(task => task.rjcode === rjcode).result = 'failed';
              removeTask(rjcode);
              addResult(rjcode, 'failed', counts.failed);
            }
          })
        );

        return Promise.all(promises).then(() => {
          const message = createScanFinishedMessage(counts);
          scannerLifecycle.finish(message, fixVAFailed ? 1 : 0);
        });
      } catch (err) {
        console.error(` ! 在并行处理音声文件夹过程中出错: ${err.message}`);
        addMainLog({
          level: 'error',
          message: `在并行处理音声文件夹过程中出错: ${err.message}`,
        });

        process.exit(1);
      }
    })
    .catch(err => {
      console.error(` ! 在构建数据库结构过程中出错: ${err.message}`);
      addMainLog({
        level: 'error',
        message: `在构建数据库结构过程中出错: ${err.message}`,
      });

      process.exit(1);
    });
};

/**
 * 更新音声的动态元数据
 * @param {number} id work id
 * @param {options = {}} options includeVA, includeTags
 */
const updateMetadata = (id, options = {}) => {
  let scrapeProcessor = () => scrapeDynamicWorkMetadataFromDLsite(id);
  if (options.includeVA || options.includeTags || options.includeNSFW || options.refreshAll) {
    // static + dynamic
    scrapeProcessor = () => scrapeWorkMetadataFromDLsite(id, config.tagLanguage);
  }

  const rjcode = formatRjCode(id);
  addTask(rjcode); // addTask only accepts a string
  return scrapeProcessor() // 抓取该音声的元数据
    .then(metadata => {
      // 将抓取到的元数据插入到数据库
      emitTaskLog(` -> [RJ${rjcode}] 元数据抓取成功，准备更新元数据...`, rjcode);
      metadata.id = id;
      return db.updateWorkMetadata(metadata, options).then(() => {
        emitTaskLog(` -> [RJ${rjcode}] 元数据更新成功`, rjcode);
        return 'updated';
      });
    })
    .catch(err => {
      emitTaskLog(`  ! [RJ${rjcode}] 在抓取元数据过程中出错: ${err}`, rjcode, 'error');
      return 'failed';
    });
};

const updateMetadataLimited = (id, options = null) => limitP.call(updateMetadata, id, options);
const updateVoiceActorLimited = id => limitP.call(updateMetadata, id, { includeVA: true });

// eslint-disable-next-line no-unused-vars
const performUpdate = async (options = null) => {
  const baseQuery = db.knex('t_work').select('id');
  const processor = id => updateMetadataLimited(id, options);

  const counts = await refreshWorks(baseQuery, 'id', processor);

  const message = createUpdateFinishedMessage(counts);
  scannerLifecycle.finish(message, counts.failed ? 1 : null);
};

const fixVoiceActorBug = () => {
  const baseQuery = db.knex('r_va_work').select('va_id', 'work_id');
  const filter = query => query.where('va_id', nameToUUID('かの仔')).orWhere('va_id', nameToUUID('こっこ'));
  const processor = id => updateVoiceActorLimited(id);
  return refreshWorks(filter(baseQuery), 'work_id', processor);
};

const refreshWorks = async (query, idColumnName, processor) => {
  return query.then(async works => {
    console.log(` * 共 ${works.length} 个音声.`);
    addMainLog({
      level: 'info',
      message: `共 ${works.length} 个作品. 开始刷新`,
    });

    const counts = new ScanCounters();

    const promises = works.map(work => {
      const workid = work[idColumnName];
      const rjcode = formatRjCode(workid);
      return processor(workid).then(result => {
        // 统计处理结果
        counts.increment(result === 'failed' ? 'failed' : 'updated');
        tasks.find(task => task.rjcode === rjcode).result = result;
        removeTask(rjcode);
        if (result === 'failed') {
          addResult(rjcode, 'failed', counts.failed);
        } else {
          addResult(rjcode, 'updated', counts.updated);
        }
      });
    });
    await Promise.all(promises);
    emitMainLog(` * 完成元数据更新 ${counts.updated} 个，失败 ${counts.failed} 个.`);

    return counts;
  });
};

module.exports = { performScan, performUpdate };
