import type { ScanCounters } from '../support/counters.js';

type UpdateLikeResult = number | { updated?: number } | null | undefined;

type UpdateLockLike = {
  isLockFilePresent: boolean;
  lockFileConfig: {
    fixVA?: boolean;
    [key: string]: unknown;
  };
  removeLockFile(): void;
};

type VoiceActorRepairRunnerOptions = {
  updateLock: UpdateLockLike;
  repairVoiceActors: () => Promise<UpdateLikeResult>;
  emitMainLog: (message: string, level?: string) => void;
};

const getUpdatedCount = (result: UpdateLikeResult): number => {
  if (typeof result === 'number') {
    return result;
  }

  return result && typeof result.updated === 'number' ? result.updated : 0;
};

const createVoiceActorRepairRunner = ({ updateLock, repairVoiceActors, emitMainLog }: VoiceActorRepairRunnerOptions) => {
  const shouldRepairVoiceActors = (): boolean => Boolean(updateLock.isLockFilePresent && updateLock.lockFileConfig.fixVA);

  const runVoiceActorRepair = async (counts: ScanCounters): Promise<boolean> => {
    if (!shouldRepairVoiceActors()) {
      return false;
    }

    // Fix hash collision bug in t_va.
    // Scan to repopulate the Voice Actor data for those problematic works: かの仔 and こっこ.
    emitMainLog(' * 开始进行声优元数据修复，需要联网');
    try {
      const updateResult = await repairVoiceActors();
      counts.increment('updated', getUpdatedCount(updateResult));
      updateLock.removeLockFile();
      emitMainLog(' * 完成元数据修复');
      return false;
    } catch (err: unknown) {
      emitMainLog(String(err), 'error');
      return true;
    }
  };

  return {
    runVoiceActorRepair,
    shouldRepairVoiceActors,
  };
};

export {
  createVoiceActorRepairRunner,
  getUpdatedCount,
};
