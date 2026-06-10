// @ts-nocheck
import { expect } from 'chai';
import { ScanCounters } from '../src/modules/scanner/counters.js';
import { createUpdateRunner } from '../src/modules/scanner/update-runner.js';

describe('createUpdateRunner', () => {
  let calls;

  beforeEach(() => {
    calls = {
      listedWorkIds: [],
      listedVoiceActorIds: [],
      refreshes: [],
      metadataUpdates: [],
      voiceActorUpdates: [],
      finishes: [],
      uuids: [],
    };
  });

  const createRunner = refreshCounts =>
    createUpdateRunner({
      listWorkIds: () => {
        const works = Promise.resolve([{ id: 123 }]);
        calls.listedWorkIds.push(works);
        return works;
      },
      listWorkIdsByVoiceActorIds: voiceActorIds => {
        const works = Promise.resolve([{ work_id: 456 }]);
        calls.listedVoiceActorIds.push(voiceActorIds);
        return works;
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

    expect(calls.listedWorkIds).to.have.lengthOf(1);
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
    expect(calls.listedVoiceActorIds).to.deep.equal([['uuid-かの仔', 'uuid-こっこ']]);
    expect(calls.uuids).to.deep.equal(['かの仔', 'こっこ']);
    expect(calls.refreshes[0].idColumnName).to.equal('work_id');
    await calls.refreshes[0].processor(456);
    expect(calls.voiceActorUpdates).to.deep.equal([456]);
  });
});
