import express from 'express';
import axios from 'axios';
import compareVersions from 'compare-versions';
import { config } from '../../../config.js';
import { updateLock } from '../../upgrade/lock.js';
import pjson from '../../../package.json' with { type: 'json' };
const router = express.Router();

type VersionCheckResponse = {
  latest_stable: string | null;
  latest_release: string | null;
  update_available: boolean | null;
};

type GitHubRelease = {
  tag_name?: string;
};

let lastGitHubCheck: number | null = null;
let lastGitHubResponse = {
  latest_stable: null,
  latest_release: null,
  update_available: null,
} satisfies VersionCheckResponse;

router.get('/', (req, res) => {
  const lockReason = '新版解决了旧版扫描时将かの仔和こっこ识别为同一个人的问题，建议进行扫描以自动修复这一问题';

  const throttledResponse = {
    current: pjson.version,
    ...lastGitHubResponse,
    notifyUser: config.checkUpdate,
    lockFileExists: updateLock.isLockFilePresent,
    lockReason: updateLock.isLockFilePresent ? lockReason : null,
  };

  if (lastGitHubCheck === null) {
    lastGitHubCheck = Date.now();
  } else {
    const currentTime = Date.now();
    const timeDiff = new Date(currentTime - lastGitHubCheck);
    if (timeDiff.getMinutes() < 5) {
      res.send(throttledResponse);
      return;
    }
  }

  const urlLatestStable = 'https://api.github.com/repos/umonaca/kikoeru-express/releases/latest';
  const urlLatestRelease = 'https://api.github.com/repos/umonaca/kikoeru-express/releases';
  const requestLatestStable = axios.get<GitHubRelease>(urlLatestStable);
  const requestLatestRelease = axios.get<GitHubRelease[]>(urlLatestRelease);

  Promise.all([requestLatestStable, requestLatestRelease])
    .then(
      ([responseStable, responseLatest]) => {
        if (
          responseStable.data &&
          responseLatest.data &&
          responseStable.data.tag_name &&
          responseLatest.data[0].tag_name
        ) {
          const current = pjson.version;
          const latest_stable = responseStable.data.tag_name;
          const latest_release = responseLatest.data[0].tag_name;
          const newVerAvailable = () => {
            if (config.checkBetaUpdate) {
              return compareVersions.compare(latest_release, current, '>');
            }
            return compareVersions.compare(latest_stable, current, '>');
          };

          lastGitHubResponse = {
            latest_stable: latest_stable,
            latest_release: latest_release,
            update_available: newVerAvailable(),
          };

          res.send({
            current: current,
            latest_stable: latest_stable,
            latest_release: latest_release,
            update_available: newVerAvailable(),
            notifyUser: config.checkUpdate,
            lockFileExists: updateLock.isLockFilePresent,
            lockReason: updateLock.isLockFilePresent ? lockReason : null,
          });
        } else {
          res.send(throttledResponse);
        }
      }
    )
    .catch(function () {
      res.send({ throttledResponse });
    });
});

export default router;
