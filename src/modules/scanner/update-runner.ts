// @ts-nocheck
import { createUpdateFinishedMessage } from './counters.js';

const createUpdateRunner = ({
  listWorkIds,
  listWorkIdsByVoiceActorIds,
  refreshWorks,
  updateMetadata,
  updateVoiceActor,
  finishUpdate,
  nameToUUID,
}) => {
  const performUpdate = async (options = null) => {
    const processor = id => updateMetadata(id, options);
    const counts = await refreshWorks(listWorkIds(), 'id', processor);

    const message = createUpdateFinishedMessage(counts);
    finishUpdate(message, counts.failed ? 1 : null);
  };

  const fixVoiceActorBug = () => {
    const voiceActorIds = [nameToUUID('かの仔'), nameToUUID('こっこ')];
    const processor = id => updateVoiceActor(id);
    return refreshWorks(listWorkIdsByVoiceActorIds(voiceActorIds), 'work_id', processor);
  };

  return {
    fixVoiceActorBug,
    performUpdate,
  };
};

export { createUpdateRunner };
