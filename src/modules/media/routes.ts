// @ts-nocheck
import express from 'express';
import fs from 'fs';
import path from 'path';
import jschardet from 'jschardet';
import { param } from 'express-validator';
import { config } from '../../../config.js';
import db from '../../database.js';
import { joinFragments } from '../../shared/http/url.js';
import { isValidRequest } from '../../shared/http/validate.js';
import { getTrackList } from './tracks.js';

const removeFileExtension = filePath => filePath.slice(0, filePath.lastIndexOf('.'));

const isSubtitleTrack = track =>
  track.title.endsWith('.lrc') || track.title.endsWith('.txt') || track.title.endsWith('.vtt');

const isWebVttTextFile = filePath => {
  try {
    const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
    return /^\s*WEBVTT/i.test(fileContent) || /\d{2}:\d{2}:\d{2}\.\d{3} -->/.test(fileContent);
  } catch {
    return false;
  }
};

const findRootFolder = work => config.rootFolders.find(rootFolder => rootFolder.name === work.root_folder);

const sendMissingRootFolder = (res, work) =>
  res.status(500).send({ error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.` });

const getWorkRootAndTracks = async id => {
  const work = await db.getWorkStorageLocation(id);
  const rootFolder = findRootFolder(work);

  if (!rootFolder) {
    return { work, rootFolder: null, tracks: [] };
  }

  const tracks = await getTrackList(id, path.join(rootFolder.path, work.dir));
  return { work, rootFolder, tracks };
};

const createOffloadUrl = (baseUrl, rootFolder, work, track) => {
  let offloadUrl = joinFragments(baseUrl, rootFolder.name, work.dir, track.subtitle || '', track.title);
  if (process.platform === 'win32') {
    offloadUrl = offloadUrl.replace(/\\/g, '/');
  }
  return offloadUrl;
};

const addMediaRoutes = (router, prefix = '/media') => {
  router.get(`${prefix}/stream/:id/:index`, param('id').isInt(), param('index').isInt(), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;

    try {
      const { work, rootFolder, tracks } = await getWorkRootAndTracks(req.params.id);
      if (!rootFolder) {
        sendMissingRootFolder(res, work);
        return;
      }

      const track = tracks[req.params.index];
      const fileName = path.join(rootFolder.path, work.dir, track.subtitle || '', track.title);
      const extName = path.extname(fileName);
      if (extName === '.txt' || extName === '.lrc' || extName === '.vtt') {
        const fileBuffer = fs.readFileSync(fileName);
        const charsetMatch = jschardet.detect(fileBuffer).encoding;
        if (charsetMatch) {
          res.setHeader('Content-Type', `text/plain; charset=${charsetMatch}`);
        }
      }
      if (extName === '.flac') {
        res.setHeader('Content-Type', 'audio/flac');
      }

      if (config.offloadMedia && extName !== '.txt' && extName !== '.lrc') {
        res.redirect(createOffloadUrl(config.offloadStreamPath, rootFolder, work, track));
      } else {
        res.sendFile(fileName);
      }
    } catch (err) {
      next(err);
    }
  });

  router.get(`${prefix}/download/:id/:index`, param('id').isInt(), param('index').isInt(), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;

    try {
      const { work, rootFolder, tracks } = await getWorkRootAndTracks(req.params.id);
      if (!rootFolder) {
        sendMissingRootFolder(res, work);
        return;
      }

      const track = tracks[req.params.index];
      if (config.offloadMedia) {
        res.redirect(createOffloadUrl(config.offloadDownloadPath, rootFolder, work, track));
      } else {
        res.download(path.join(rootFolder.path, work.dir, track.subtitle || '', track.title));
      }
    } catch (err) {
      next(err);
    }
  });

  router.get(`${prefix}/find-all-lrc/:id/:index`, param('id').isInt(), param('index').isInt(), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;

    try {
      const { work, rootFolder, tracks } = await getWorkRootAndTracks(req.params.id);
      if (!rootFolder) {
        sendMissingRootFolder(res, work);
        return;
      }

      const subtitlesItems = tracks.filter(trackItem => {
        if (!isSubtitleTrack(trackItem)) {
          return false;
        }

        const lrcFileLoc = path.join(rootFolder.path, work.dir, trackItem.subtitle || '', trackItem.title);
        if (trackItem.title.endsWith('.txt') && !isWebVttTextFile(lrcFileLoc)) {
          return false;
        }

        return fs.existsSync(lrcFileLoc);
      });

      if (subtitlesItems.length > 0) {
        res.send({ result: true, message: `找到${subtitlesItems.length}个可能的歌词文件`, subtitlesItems });
      } else {
        res.send({ result: false, message: '未找到歌词文件', subtitlesItems: [] });
      }
    } catch (err) {
      next(err);
    }
  });

  router.get(`${prefix}/check-lrc/:id/:index`, param('id').isInt(), param('index').isInt(), async (req, res, next) => {
    if (!isValidRequest(req, res)) return;

    try {
      const { work, rootFolder, tracks } = await getWorkRootAndTracks(req.params.id);
      if (!rootFolder) {
        sendMissingRootFolder(res, work);
        return;
      }

      const track = tracks[req.params.index];
      const fileLoc = path.join(rootFolder.path, work.dir, track.subtitle || '', track.title);
      let lrcFileLoc = `${removeFileExtension(fileLoc)}.lrc`;
      let lrcFileName = `${removeFileExtension(track.title)}.lrc`;
      let subtitleToFind = track.subtitle;

      if (!fs.existsSync(lrcFileLoc)) {
        const trackTitle = track.title;
        const trackTitleWithoutExt = removeFileExtension(trackTitle);

        for (const trackItem of tracks) {
          if (!isSubtitleTrack(trackItem)) {
            continue;
          }

          const trackItemTitleWithoutExt = removeFileExtension(trackItem.title);
          if (trackItemTitleWithoutExt !== trackTitle && trackItemTitleWithoutExt !== trackTitleWithoutExt) {
            continue;
          }

          const trackItemPath = path.join(rootFolder.path, work.dir, trackItem.subtitle || '', trackItem.title);
          if (trackItem.title.endsWith('.txt') && !isWebVttTextFile(trackItemPath)) {
            continue;
          }

          lrcFileLoc = trackItemPath;
          lrcFileName = trackItem.title;
          subtitleToFind = trackItem.subtitle;
        }
      }

      if (!fs.existsSync(lrcFileLoc)) {
        res.send({ result: false, message: '不存在歌词文件', hash: '' });
        return;
      }

      const foundTrack = tracks.find(trackItem => trackItem.title === lrcFileName && trackItem.subtitle === subtitleToFind);
      if (foundTrack) {
        res.send({ result: true, message: '找到歌词文件', hash: foundTrack.hash });
      }
    } catch (err) {
      next(err);
    }
  });
};

const createMediaRouter = ({ includeMediaPrefix = true } = {}) => {
  const router = express.Router();

  addMediaRoutes(router, includeMediaPrefix ? '/media' : '');

  return router;
};

const router = createMediaRouter();
router.createMediaRouter = createMediaRouter;

export default router;