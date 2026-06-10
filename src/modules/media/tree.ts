import { config } from '../../../config.js';
import type { RootFolderConfig } from '../../config/types.js';
import { joinFragments } from '../../shared/http/url.js';
import type { Track } from './tracks.js';

const textExtensions = new Set(['.txt', '.lrc', '.srt', '.ass']);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export type TrackTreeNode =
  | {
      type: 'folder';
      title: string;
      children: TrackTreeNode[];
    }
  | {
      type: 'text' | 'image' | 'other' | 'audio';
      hash: string;
      title: string;
      workTitle: string;
      mediaStreamUrl: string;
      mediaDownloadUrl: string;
    };

type FolderNode = Extract<TrackTreeNode, { type: 'folder' }>;

const findFolderNode = (nodes: TrackTreeNode[], title: string): FolderNode | undefined =>
  nodes.find((item): item is FolderNode => item.type === 'folder' && item.title === title);

const toTree = (tracks: Track[], workTitle: string, workDir: string, rootFolder: RootFolderConfig): TrackTreeNode[] => {
  const tree: TrackTreeNode[] = [];

  tracks.forEach(track => {
    let fatherFolder = tree;
    const filePath = track.subtitle ? track.subtitle.split('/') : [];
    filePath.forEach(folderName => {
      const index = fatherFolder.findIndex(item => item.type === 'folder' && item.title === folderName);
      if (index === -1) {
        fatherFolder.push({
          type: 'folder',
          title: folderName,
          children: [],
        });
      }
      fatherFolder = findFolderNode(fatherFolder, folderName)?.children || fatherFolder;
    });
  });

  tracks.forEach(track => {
    let fatherFolder = tree;
    const paths = track.subtitle ? track.subtitle.split('/') : [];
    paths.forEach(folderName => {
      fatherFolder = findFolderNode(fatherFolder, folderName)?.children || fatherFolder;
    });

    let offloadStreamUrl = joinFragments(
      config.offloadStreamPath,
      rootFolder.name,
      workDir,
      track.subtitle || '',
      track.title
    );
    let offloadDownloadUrl = joinFragments(
      config.offloadDownloadPath,
      rootFolder.name,
      workDir,
      track.subtitle || '',
      track.title
    );
    if (process.platform === 'win32') {
      offloadStreamUrl = offloadStreamUrl.replace(/\\/g, '/');
      offloadDownloadUrl = offloadDownloadUrl.replace(/\\/g, '/');
    }

    const textBaseUrl = '/api/media/stream/';
    const mediaStreamBaseUrl = '/api/media/stream/';
    const mediaDownloadBaseUrl = '/api/media/download/';
    const textStreamBaseUrl = textBaseUrl + track.hash;
    const textDownloadBaseUrl = config.offloadMedia ? offloadDownloadUrl : mediaDownloadBaseUrl + track.hash;
    const mediaStreamUrl = config.offloadMedia ? offloadStreamUrl : mediaStreamBaseUrl + track.hash;
    const mediaDownloadUrl = config.offloadMedia ? offloadDownloadUrl : mediaDownloadBaseUrl + track.hash;

    if (textExtensions.has(track.ext)) {
      fatherFolder.push({
        type: 'text',
        hash: track.hash,
        title: track.title,
        workTitle,
        mediaStreamUrl: textStreamBaseUrl,
        mediaDownloadUrl: textDownloadBaseUrl,
      });
    } else if (imageExtensions.has(track.ext)) {
      fatherFolder.push({
        type: 'image',
        hash: track.hash,
        title: track.title,
        workTitle,
        mediaStreamUrl,
        mediaDownloadUrl,
      });
    } else if (track.ext === '.pdf') {
      fatherFolder.push({
        type: 'other',
        hash: track.hash,
        title: track.title,
        workTitle,
        mediaStreamUrl,
        mediaDownloadUrl,
      });
    } else {
      fatherFolder.push({
        type: 'audio',
        hash: track.hash,
        title: track.title,
        workTitle,
        mediaStreamUrl,
        mediaDownloadUrl,
      });
    }
  });

  return tree;
};

export { toTree };
