const { expect } = require('chai');
const { ScanCounters } = require('../src/modules/scanner/counters');
const { createUpdateRunner } = require('../src/modules/scanner/update-runner');

const createQuery = tableName => {
  const query = {
    tableName,
    selected: [],
    filters: [],
    select: (...columns) => {
      query.selected = columns;
      return query;
    },
    where: (...args) => {
      query.filters.push({ method: 'where', args });
      return query;
    },
    orWhere: (...args) => {
      query.filters.push({ method: 'orWhere', args });
      return query;
    },
  };
  return query;
};

describe('createUpdateRunner', () => {
  let calls;

  beforeEach(() => {
    calls = {
      queries: [],
      refreshes: [],
      metadataUpdates: [],
      voiceActorUpdates: [],
      finishes: [],
      uuids: [],
    };
  });

  const createRunner = refreshCounts =>
    createUpdateRunner({
      knex: tableName => {
        const query = createQuery(tableName);
        calls.queries.push(query);
        return query;
      },
      refreshWorks: (query, idColumnName, processor) => {
        calls.refreshes.push({ query, idColumnName, processor });
        return Promise.resolve(refreshCounts || new ScanCounters());
      },
      updateMetadata: (id, options) => {
        calls.metadataUpdates.push({ id, options });
        return Promise.resolve('updated');
      },
      updateVoiceActor: id => {
        calls.voiceActorUpdates.push(id);
        return Promise.resolve('updated');
      },
      finishUpdate: (message, exitCode) => calls.finishes.push({ message, exitCode }),
      nameToUUID: name => {
        calls.uuids.push(name);
        return `uuid-${name}`;
      },
    });

  it('refreshes all works and finishes with the update summary', async () => {
    const { performUpdate } = createRunner(new ScanCounters({ updated: 2, failed: 0 }));

    await performUpdate({ refreshAll: true });

    expect(calls.queries[0].tableName).to.equal('t_work');
    expect(calls.queries[0].selected).to.deep.equal(['id']);
    expect(calls.refreshes[0].idColumnName).to.equal('id');
    await calls.refreshes[0].processor(123);
    expect(calls.metadataUpdates).to.deep.equal([{ id: 123, options: { refreshAll: true } }]);
    expect(calls.finishes).to.deep.equal([
      {
        message: '扫描完成: 更新 2 个，失败 0 个.',
        exitCode: null,
      },
    ]);
  });

  it('uses exit code 1 when update refresh has failures', async () => {
    const { performUpdate } = createRunner(new ScanCounters({ updated: 1, failed: 1 }));

    await performUpdate();

    expect(calls.finishes[0]).to.deep.equal({
      message: '扫描完成: 更新 1 个，失败 1 个.',
      exitCode: 1,
    });
  });

  it('refreshes works affected by the legacy voice actor hash collision', async () => {
    const { fixVoiceActorBug } = createRunner(new ScanCounters({ updated: 2 }));

    const counts = await fixVoiceActorBug();

    expect(counts.updated).to.equal(2);
    expect(calls.queries[0].tableName).to.equal('r_va_work');
    expect(calls.queries[0].selected).to.deep.equal(['va_id', 'work_id']);
    expect(calls.queries[0].filters).to.deep.equal([
      { method: 'where', args: ['va_id', 'uuid-かの仔'] },
      { method: 'orWhere', args: ['va_id', 'uuid-こっこ'] },
    ]);
    expect(calls.uuids).to.deep.equal(['かの仔', 'こっこ']);
    expect(calls.refreshes[0].idColumnName).to.equal('work_id');
    await calls.refreshes[0].processor(456);
    expect(calls.voiceActorUpdates).to.deep.equal([456]);
  });
});
