export type RootFolderConfig = {
  name: string;
  path: string;
};

export type AppConfig = {
  version: string;
  production: boolean;
  dbBusyTimeout: number;
  checkUpdate: boolean;
  checkBetaUpdate: boolean;
  maxParallelism: number;
  rootFolders: RootFolderConfig[];
  coverFolderDir: string;
  databaseFolderDir: string;
  coverUseDefaultPath: boolean;
  dbUseDefaultPath: boolean;
  voiceWorkDefaultPath: string;
  auth: boolean;
  md5secret: string;
  jwtsecret: string;
  expiresIn: number;
  scannerMaxRecursionDepth: number;
  pageSize: number;
  tagLanguage: string;
  retry: number;
  dlsiteTimeout: number;
  hvdbTimeout: number;
  retryDelay: number;
  httpProxyHost: string;
  httpProxyPort: number;
  listenPort: number;
  blockRemoteConnection: boolean;
  behindProxy: boolean;
  httpsEnabled: boolean;
  httpsPrivateKey: string;
  httpsCert: string;
  httpsPort: number;
  skipCleanup: boolean;
  enableGzip: boolean;
  rewindSeekTime: number;
  forwardSeekTime: number;
  offloadMedia: boolean;
  offloadStreamPath: string;
  offloadDownloadPath: string;
};

export type PublicConfigSnapshot = Pick<AppConfig, 'rewindSeekTime' | 'forwardSeekTime'>;

export type SharedConfigHandle = {
  readonly rewindSeekTime: number;
  readonly forwardSeekTime: number;
  export(): PublicConfigSnapshot;
};

export type ConfigStore = {
  config: AppConfig;
  configFolderDir: string;
  configPath: string;
  defaultConfig: AppConfig;
  initialize(): void;
  initConfig(writeConfigToFile?: boolean): void;
  readConfig(): void;
  setConfig(newConfig: Partial<AppConfig>, writeConfigToFile?: boolean): void;
  sharedConfigHandle: SharedConfigHandle;
  updateConfig(writeConfigToFile?: boolean): void;
};
