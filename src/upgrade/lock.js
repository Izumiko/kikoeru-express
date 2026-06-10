const fs = require('fs');
const path = require('path');

const { configFolderDir } = require('../../config');

class UpgradeLock {
  constructor(fileName = 'update.lock') {
    this.lockFileConfig = {};
    this.lockFilePath = path.join(configFolderDir, fileName);
    this._init();
  }

  _init() {
    if (this.isLockFilePresent) {
      this.readLockFileConfig();
    }
  }

  get isLockFilePresent() {
    return fs.existsSync(this.lockFilePath);
  }

  readLockFileConfig() {
    this.lockFileConfig = JSON.parse(fs.readFileSync(this.lockFilePath));
  }

  createLockFile(lockConfig) {
    this.lockFileConfig = lockConfig;
    fs.writeFileSync(this.lockFilePath, JSON.stringify(this.lockFileConfig, null, '\t'));
  }

  updateLockFile(lockConfig) {
    this.createLockFile(lockConfig);
  }

  removeLockFile() {
    if (this.isLockFilePresent) {
      fs.unlinkSync(this.lockFilePath);
    }
    this.lockFileConfig = {};
  }
}

const updateLock = new UpgradeLock();

module.exports = { updateLock };
