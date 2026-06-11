import path from 'path';
import { expect } from 'vitest';
import { createMissingWorkCleaner } from '../src/modules/scanner/workers/missing-work-cleaner.js';

const existingWorkPath = path.join('/library', 'RJ000123');

describe('createMissingWorkCleaner', () => {
  let calls;

  beforeEach(() => {
    calls = {
      removed: [],
      deletedCovers: [],
      mainLogs: [],
      consoleErrors: [],
    };
  });

  const createCleaner = options =>
    createMissingWorkCleaner({
      listWorkStorageLocations: () => Promise.resolve(options.works || []),
      rootFolders: [{ name: 'VoiceWork', path: '/library' }],
      removeWork: id => {
        calls.removed.push({ id });
        return Promise.resolve(`removed-${id}`);
      },
      deleteCoverImageFromDisk: rjcode => {
        calls.deletedCovers.push(rjcode);
        return options.deleteCoverImageFromDisk
          ? options.deleteCoverImageFromDisk(rjcode)
          : Promise.resolve(`deleted-${rjcode}`);
      },
      addMainLog: log => calls.mainLogs.push(log),
      fileSystem: {
        existsSync: filePath => options.existingPaths.includes(filePath),
      },
      consoleLogger: {
        error: message => calls.consoleErrors.push(message),
      },
  });

  it('keeps works whose local folder still exists', async () => {
    const { cleanupWorks } = createCleaner({ existingPaths: [existingWorkPath] });

    await cleanupWorks([{ id: 123, root_folder: 'VoiceWork', dir: 'RJ000123' }]);

    expect(calls.removed).to.deep.equal([]);
    expect(calls.deletedCovers).to.deep.equal([]);
  });

  it('removes metadata and cover files for missing work folders', async () => {
    const { cleanupWorks } = createCleaner({ existingPaths: [] });

    await cleanupWorks([{ id: 123, root_folder: 'VoiceWork', dir: 'RJ000123' }]);

    expect(calls.removed).to.deep.equal([{ id: 123 }]);
    expect(calls.deletedCovers).to.deep.equal(['000123']);
  });

  it('treats missing root folder configuration as a missing work folder', async () => {
    const { cleanupWorks } = createCleaner({ existingPaths: [existingWorkPath] });

    await cleanupWorks([{ id: 123, root_folder: 'RemovedRoot', dir: 'RJ000123' }]);

    expect(calls.removed).to.deep.equal([{ id: 123 }]);
  });

  it('ignores already-missing cover files during cleanup', async () => {
    const { cleanupWorks } = createCleaner({
      existingPaths: [],
      deleteCoverImageFromDisk: () => Promise.reject(Object.assign(new Error('missing'), { code: 'ENOENT' })),
    });

    await cleanupWorks([{ id: 123, root_folder: 'VoiceWork', dir: 'RJ000123' }]);

    expect(calls.mainLogs).to.deep.equal([]);
    expect(calls.consoleErrors).to.deep.equal([]);
  });

  it('logs unexpected cover deletion errors and still completes cleanup', async () => {
    const { cleanupWorks } = createCleaner({
      existingPaths: [],
      deleteCoverImageFromDisk: () => Promise.reject(new Error('disk failure')),
    });

    await cleanupWorks([{ id: 123, root_folder: 'VoiceWork', dir: 'RJ000123' }]);

    expect(calls.mainLogs).to.deep.equal([
      {
        level: 'error',
        message: '[RJ000123] 在删除封面过程中出错: disk failure',
      },
    ]);
    expect(calls.consoleErrors).to.deep.equal(['  ! [RJ000123] 在删除封面过程中出错: disk failure']);
  });

  it('loads work storage locations before performing cleanup', async () => {
    const { performCleanup } = createCleaner({
      existingPaths: [],
      works: [{ id: 123, root_folder: 'VoiceWork', dir: 'RJ000123' }],
    });

    await performCleanup();

    expect(calls.removed).to.deep.equal([{ id: 123 }]);
    expect(calls.deletedCovers).to.deep.equal(['000123']);
  });
});
