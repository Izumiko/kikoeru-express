const getUpdatedCount = result => {
  if (typeof result === 'number') {
    return result;
  }

  return result && typeof result.updated === 'number' ? result.updated : 0;
};

const createVoiceActorRepairRunner = ({ updateLock, repairVoiceActors, emitMainLog }) => {
  const shouldRepairVoiceActors = () => updateLock.isLockFilePresent && updateLock.lockFileConfig.fixVA;

  const runVoiceActorRepair = async counts => {
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
    } catch (err) {
      emitMainLog(err.toString(), 'error');
      return true;
    }
  };

  return {
    runVoiceActorRepair,
    shouldRepairVoiceActors,
  };
};

module.exports = {
  createVoiceActorRepairRunner,
  getUpdatedCount,
};
