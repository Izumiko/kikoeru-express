import express from 'express';
import type { Request, Response, NextFunction, Router } from 'express';
import fs from 'fs';
import path from 'path';
import jschardet from 'jschardet';
import { param } from 'express-validator';
import { config } from '../../config/index.js';
import type { RootFolderConfig } from '../../config/types.js';
import db from '../../database.js';
import { joinFragments } from '../../shared/http/url.js';
import { isValidRequest } from '../../shared/http/validate.js';
import { getTrackList } from './tracks.js';
import type { Track } from './tracks.js';

type WorkStorage = {
  root_folder: string;
  dir: string;
};

const removeFileExtension = (filePath: string) => filePath.slice(0, filePath.lastIndexOf('.'));

const isSubtitleTrack = (track: Track) =>
  track.title.endsWith('.lrc') || track.title.endsWith('.txt') || track.title.endsWith('.vtt');

const isWebVttTextFile = (filePath: string) => {
  try {
    const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
    return /^\s*WEBVTT/i.test(fileContent) || /\d{2}:\d{2}:\d{2}\.\d{3} -->/.test(fileContent);
  } catch {
    return false;
  }
};

const findRootFolder = (work: WorkStorage) =>
  config.rootFolders.find((rootFolder) => rootFolder.name === work.root_folder);

const sendMissingRootFolder = (res: Response, work: WorkStorage) =>
  res.status(500).send({ error: `找不到文件夹: "${work.root_folder}"，请尝试重启服务器或重新扫描.` });

const getWorkRootAndTracks = async (id: string | number) => {
  const numId = typeof id === 'string' ? Number(id) : id;
  const work = await db.getWorkStorageLocation(numId);
  const rootFolder = findRootFolder(work);

  if (!rootFolder) {
    return { work, rootFolder: null as RootFolderConfig | null, tracks: [] as Track[] };
  }

  const tracks = await getTrackList(numId, path.join(rootFolder.path, work.dir));
  return { work, rootFolder, tracks };
};

const createOffloadUrl = (baseUrl: string, rootFolder: RootFolderConfig, work: WorkStorage, track: Track) => {
  let offloadUrl = joinFragments(baseUrl, rootFolder.name, work.dir, track.subtitle || '', track.title);
  if (process.platform === 'win32') {
    offloadUrl = offloadUrl.replace(/\\/g, '/');
  }
  return offloadUrl;
};

const addMediaRoutes = (router: Router, prefix = '/media') => {
  router.get(
    `${prefix}/stream/:id/:index`,
    param('id').isInt(),
    param('index').isInt(),
    async (req: Request, res: Response, next: NextFunction) => {
      if (!isValidRequest(req, res)) return;

      try {
        const id = req.params.id as string;
        const index = req.params.index as string;
        const { work, rootFolder, tracks } = await getWorkRootAndTracks(id);
        if (!rootFolder) {
          sendMissingRootFolder(res, work);
          return;
        }

        const track = tracks[Number(index)];
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
    }
  );

  router.get(
    `${prefix}/download/:id/:index`,
    param('id').isInt(),
    param('index').isInt(),
    async (req: Request, res: Response, next: NextFunction) => {
      if (!isValidRequest(req, res)) return;

      try {
        const id = req.params.id as string;
        const index = req.params.index as string;
        const { work, rootFolder, tracks } = await getWorkRootAndTracks(id);
        if (!rootFolder) {
          sendMissingRootFolder(res, work);
          return;
        }

        const track = tracks[Number(index)];
        if (config.offloadMedia) {
          res.redirect(createOffloadUrl(config.offloadDownloadPath, rootFolder, work, track));
        } else {
          res.download(path.join(rootFolder.path, work.dir, track.subtitle || '', track.title));
        }
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    `${prefix}/find-all-lrc/:id/:index`,
    param('id').isInt(),
    param('index').isInt(),
    async (req: Request, res: Response, next: NextFunction) => {
      if (!isValidRequest(req, res)) return;

      try {
        const id = req.params.id as string;
        const { work, rootFolder, tracks } = await getWorkRootAndTracks(id);
        if (!rootFolder) {
          sendMissingRootFolder(res, work);
          return;
        }

        const subtitlesItems = tracks.filter((trackItem) => {
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
    }
  );

  router.get(
    `${prefix}/check-lrc/:id/:index`,
    param('id').isInt(),
    param('index').isInt(),
    async (req: Request, res: Response, next: NextFunction) => {
      if (!isValidRequest(req, res)) return;

      try {
        const id = req.params.id as string;
        const index = req.params.index as string;
        const { work, rootFolder, tracks } = await getWorkRootAndTracks(id);
        if (!rootFolder) {
          sendMissingRootFolder(res, work);
          return;
        }

        const track = tracks[Number(index)];
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

        const foundTrack = tracks.find(
          (trackItem) => trackItem.title === lrcFileName && trackItem.subtitle === subtitleToFind
        );
        if (foundTrack) {
          res.send({ result: true, message: '找到歌词文件', hash: foundTrack.hash });
        }
      } catch (err) {
        next(err);
      }
    }
  );
};

const createMediaRouter = ({ includeMediaPrefix = true } = {}) => {
  const router = express.Router();

  addMediaRoutes(router, includeMediaPrefix ? '/media' : '');

  return router;
};

const router = createMediaRouter() as Router & { createMediaRouter: typeof createMediaRouter };
router.createMediaRouter = createMediaRouter;

export default router;
