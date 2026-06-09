const crypto = require('crypto');

const {
  getDefaultCoverFolderDir,
  getDefaultDatabaseFolderDir,
  getVoiceWorkDefaultPath,
} = require('./paths.js');

const createDefaultConfig = ({ projectRoot, version }) => ({
  version,
  production: process.env.NODE_ENV === 'production' ? true : false,
  dbBusyTimeout: 1000,
  checkUpdate: true,
  checkBetaUpdate: false,
  maxParallelism: 16,
  rootFolders: [
    // {
    //   name: '',
    //   path: ''
    // }
  ],
  coverFolderDir: getDefaultCoverFolderDir(projectRoot),
  databaseFolderDir: getDefaultDatabaseFolderDir(projectRoot),
  coverUseDefaultPath: false, // Ignores coverFolderDir if set to true
  dbUseDefaultPath: true, // Ignores databaseFolderDir if set to true
  voiceWorkDefaultPath: getVoiceWorkDefaultPath(projectRoot),
  auth: process.env.NODE_ENV === 'production' ? true : false,
  md5secret: crypto.randomBytes(32).toString('hex'),
  jwtsecret: crypto.randomBytes(32).toString('hex'),
  expiresIn: 2592000,
  scannerMaxRecursionDepth: 2,
  pageSize: 12,
  tagLanguage: 'zh-cn',
  retry: 5,
  dlsiteTimeout: 10000,
  hvdbTimeout: 10000,
  retryDelay: 2000,
  httpProxyHost: '',
  httpProxyPort: 0,
  listenPort: 8888,
  blockRemoteConnection: false,
  behindProxy: false,
  httpsEnabled: false,
  httpsPrivateKey: 'kikoeru.key',
  httpsCert: 'kikoeru.crt',
  httpsPort: 8443,
  skipCleanup: false,
  enableGzip: true,
  rewindSeekTime: 5,
  forwardSeekTime: 30,
  offloadMedia: false,
  offloadStreamPath: '/media/stream/', // /media/stream/RJ123456/subdirs/track.mp3
  offloadDownloadPath: '/media/download/', // /media/download/RJ123456/subdirs/track.mp3
});

module.exports = { createDefaultConfig };
