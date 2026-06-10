type ScanResult = 'added' | 'failed' | 'skipped' | 'updated';

type ScanCounts = Record<ScanResult, number>;

class ScanCounters {
  added: number;
  failed: number;
  skipped: number;
  updated: number;

  constructor(initial: Partial<ScanCounts> = {}) {
    this.added = initial.added || 0;
    this.failed = initial.failed || 0;
    this.skipped = initial.skipped || 0;
    this.updated = initial.updated || 0;
  }

  increment(result: ScanResult, count = 1): number {
    this[result] += count;
    return this[result];
  }

  toJSON(): ScanCounts {
    return {
      added: this.added,
      failed: this.failed,
      skipped: this.skipped,
      updated: this.updated,
    };
  }
}

const createScanFinishedMessage = (counts: ScanCounts): string =>
  counts.updated
    ? `扫描完成: 更新 ${counts.updated} 个，新增 ${counts.added} 个，跳过 ${counts.skipped} 个，失败 ${counts.failed} 个.`
    : `扫描完成: 新增 ${counts.added} 个，跳过 ${counts.skipped} 个，失败 ${counts.failed} 个.`;

const createUpdateFinishedMessage = (counts: ScanCounts): string =>
  `扫描完成: 更新 ${counts.updated} 个，失败 ${counts.failed} 个.`;

export {
  ScanCounters,
  createScanFinishedMessage,
  createUpdateFinishedMessage,
};
export type { ScanCounts, ScanResult };
