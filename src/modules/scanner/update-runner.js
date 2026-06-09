const { createUpdateFinishedMessage } = require('./counters');

const createUpdateRunner = ({ knex, refreshWorks, updateMetadata, updateVoiceActor, finishUpdate, nameToUUID }) => {
  const performUpdate = async (options = null) => {
    const baseQuery = knex('t_work').select('id');
    const processor = id => updateMetadata(id, options);
    const counts = await refreshWorks(baseQuery, 'id', processor);

    const message = createUpdateFinishedMessage(counts);
    finishUpdate(message, counts.failed ? 1 : null);
  };

  const fixVoiceActorBug = () => {
    const baseQuery = knex('r_va_work').select('va_id', 'work_id');
    const filter = query => query.where('va_id', nameToUUID('かの仔')).orWhere('va_id', nameToUUID('こっこ'));
    const processor = id => updateVoiceActor(id);
    return refreshWorks(filter(baseQuery), 'work_id', processor);
  };

  return {
    fixVoiceActorBug,
    performUpdate,
  };
};

module.exports = { createUpdateRunner };
