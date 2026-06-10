// @ts-nocheck
import { expect } from 'chai';
import {
  ScanCounters,
  createScanFinishedMessage,
  createUpdateFinishedMessage,
} from '../src/modules/scanner/counters.js';

describe('ScanCounters', () => {
  it('tracks scan result counts with the legacy keys', () => {
    const counts = new ScanCounters();

    expect(counts.increment('added')).to.equal(1);
    expect(counts.increment('skipped', 2)).to.equal(2);
    expect(counts.increment('failed')).to.equal(1);
    expect(counts.increment('updated', 3)).to.equal(3);

    expect(counts.toJSON()).to.deep.equal({
      added: 1,
      failed: 1,
      skipped: 2,
      updated: 3,
    });
  });

  it('formats full scan finished messages without updates', () => {
    const counts = new ScanCounters({ added: 2, skipped: 1, failed: 0 });

    expect(createScanFinishedMessage(counts)).to.equal('扫描完成: 新增 2 个，跳过 1 个，失败 0 个.');
  });

  it('formats full scan finished messages with updates', () => {
    const counts = new ScanCounters({ updated: 1, added: 2, skipped: 3, failed: 4 });

    expect(createScanFinishedMessage(counts)).to.equal('扫描完成: 更新 1 个，新增 2 个，跳过 3 个，失败 4 个.');
  });

  it('formats update scan finished messages', () => {
    const counts = new ScanCounters({ updated: 3, failed: 1 });

    expect(createUpdateFinishedMessage(counts)).to.equal('扫描完成: 更新 3 个，失败 1 个.');
  });
});
