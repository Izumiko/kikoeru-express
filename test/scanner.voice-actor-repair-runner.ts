import { expect } from 'vitest';
import { ScanCounters } from '../src/modules/scanner/support/counters.js';
import {
  createVoiceActorRepairRunner,
  getUpdatedCount,
} from '../src/modules/scanner/workers/voice-actor-repair-runner.js';

describe('createVoiceActorRepairRunner', () => {
  let calls;

  beforeEach(() => {
    calls = {
      repairs: 0,
      removedLocks: 0,
      mainLogs: [],
    };
  });

  const createRunner = options =>
    createVoiceActorRepairRunner({
      updateLock: {
        isLockFilePresent: options.isLockFilePresent,
        lockFileConfig: { fixVA: options.fixVA },
        removeLockFile: () => {
          calls.removedLocks += 1;
        },
      },
      repairVoiceActors: () => {
        calls.repairs += 1;
        return options.repairError ? Promise.reject(options.repairError) : Promise.resolve(options.repairResult);
      },
      emitMainLog: (message, level) => calls.mainLogs.push({ message, level }),
    });

  it('skips repair when the lock file is absent', async () => {
    const { runVoiceActorRepair } = createRunner({ isLockFilePresent: false, fixVA: true });
    const counts = new ScanCounters();

    const failed = await runVoiceActorRepair(counts);

    expect(failed).to.equal(false);
    expect(calls.repairs).to.equal(0);
    expect(calls.mainLogs).to.deep.equal([]);
  });

  it('runs repair and adds updated count from returned counters', async () => {
    const repairResult = new ScanCounters({ updated: 2, failed: 1 });
    const { runVoiceActorRepair } = createRunner({
      isLockFilePresent: true,
      fixVA: true,
      repairResult,
    });
    const counts = new ScanCounters({ updated: 3 });

    const failed = await runVoiceActorRepair(counts);

    expect(failed).to.equal(false);
    expect(counts.updated).to.equal(5);
    expect(calls.removedLocks).to.equal(1);
    expect(calls.mainLogs).to.deep.equal([
      { message: ' * 开始进行声优元数据修复，需要联网', level: undefined },
      { message: ' * 完成元数据修复', level: undefined },
    ]);
  });

  it('returns failure and keeps the lock when repair throws', async () => {
    const { runVoiceActorRepair } = createRunner({
      isLockFilePresent: true,
      fixVA: true,
      repairError: new Error('network failure'),
    });

    const failed = await runVoiceActorRepair(new ScanCounters());

    expect(failed).to.equal(true);
    expect(calls.removedLocks).to.equal(0);
    expect(calls.mainLogs).to.deep.equal([
      { message: ' * 开始进行声优元数据修复，需要联网', level: undefined },
      { message: 'Error: network failure', level: 'error' },
    ]);
  });
});

describe('getUpdatedCount', () => {
  it('supports numeric and ScanCounters results', () => {
    expect(getUpdatedCount(2)).to.equal(2);
    expect(getUpdatedCount(new ScanCounters({ updated: 3 }))).to.equal(3);
    expect(getUpdatedCount(null)).to.equal(0);
  });
});
