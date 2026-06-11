import fs from 'fs';
import path from 'path';
import { configFolderDir } from '../../config.js';

type LockFileConfig = Record<string, unknown>;

class UpgradeLock {
  lockFileConfig: LockFileConfig;
  lockFilePath: string;

  constructor(fileName = 'update.lock') {
    this.lockFileConfig = {};
    this.lockFilePath = path.join(configFolderDir, fileName);
    this._init();
  }

  _init(): void {
    if (this.isLockFilePresent) {
      this.readLockFileConfig();
    }
  }

  get isLockFilePresent(): boolean {
    return fs.existsSync(this.lockFilePath);
  }

  readLockFileConfig(): void {
    this.lockFileConfig = JSON.parse(fs.readFileSync(this.lockFilePath, 'utf8')) as LockFileConfig;
  }

  createLockFile(lockConfig: LockFileConfig): void {
    this.lockFileConfig = lockConfig;
    fs.writeFileSync(this.lockFilePath, JSON.stringify(this.lockFileConfig, null, '\t'));
  }

  updateLockFile(lockConfig: LockFileConfig): void {
    this.createLockFile(lockConfig);
  }

  removeLockFile(): void {
    if (this.isLockFilePresent) {
      fs.unlinkSync(this.lockFilePath);
    }
    this.lockFileConfig = {};
  }
}

const updateLock = new UpgradeLock();

export { updateLock };
