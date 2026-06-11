import type { ScanCounters} from '../support/counters.js';
import { createUpdateFinishedMessage } from '../support/counters.js';
import type { MetadataUpdateOptions } from '../workers/metadata-updater.js';

type WorkIdRow = { id: number };
type VoiceActorWorkIdRow = { work_id: number };

type UpdateRunnerOptions = {
  listWorkIds: () => Promise<WorkIdRow[]>;
  listWorkIdsByVoiceActorIds: (voiceActorIds: string[]) => Promise<VoiceActorWorkIdRow[]>;
  refreshWorks: (
    query: Promise<WorkIdRow[] | VoiceActorWorkIdRow[]>,
    idColumnName: string,
    processor: (id: number) => Promise<'updated' | 'failed'>
  ) => Promise<ScanCounters>;
  updateMetadata: (id: number, options: MetadataUpdateOptions | null) => Promise<'updated' | 'failed'>;
  updateVoiceActor: (id: number) => Promise<'updated' | 'failed'>;
  finishUpdate: (message: string, exitCode: number | null) => void;
  nameToUUID: (name: string) => string;
};

const createUpdateRunner = ({
  listWorkIds,
  listWorkIdsByVoiceActorIds,
  refreshWorks,
  updateMetadata,
  updateVoiceActor,
  finishUpdate,
  nameToUUID,
}: UpdateRunnerOptions) => {
  const performUpdate = async (options: MetadataUpdateOptions | null = null): Promise<void> => {
    const processor = (id: number) => updateMetadata(id, options);
    const counts = await refreshWorks(listWorkIds(), 'id', processor);

    const message = createUpdateFinishedMessage(counts);
    finishUpdate(message, counts.failed ? 1 : null);
  };

  const fixVoiceActorBug = (): Promise<ScanCounters> => {
    const voiceActorIds = [nameToUUID('かの仔'), nameToUUID('こっこ')];
    const processor = (id: number) => updateVoiceActor(id);
    return refreshWorks(listWorkIdsByVoiceActorIds(voiceActorIds), 'work_id', processor);
  };

  return {
    fixVoiceActorBug,
    performUpdate,
  };
};

export { createUpdateRunner };
