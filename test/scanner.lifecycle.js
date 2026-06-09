/* eslint-disable node/no-unpublished-require */
const { expect } = require('chai');
const { ScannerLifecycle } = require('../src/modules/scanner/lifecycle');

describe('ScannerLifecycle', () => {
  let events;
  let destroyed;
  let exitCodes;
  let logs;
  let lifecycle;

  beforeEach(() => {
    events = [];
    destroyed = false;
    exitCodes = [];
    logs = [];
    lifecycle = new ScannerLifecycle({
      send: event => events.push(event),
      destroyDatabase: () => {
        destroyed = true;
      },
      exit: code => exitCodes.push(code),
      consoleLogger: {
        log: message => logs.push(message),
      },
    });
  });

  it('emits the legacy scan finished event and tears down the database', () => {
    lifecycle.finish('扫描完成: 新增 1 个，跳过 0 个，失败 0 个.');

    expect(logs).to.deep.equal([' * 扫描完成: 新增 1 个，跳过 0 个，失败 0 个.']);
    expect(events).to.deep.equal([
      {
        event: 'SCAN_FINISHED',
        payload: {
          message: '扫描完成: 新增 1 个，跳过 0 个，失败 0 个.',
        },
      },
    ]);
    expect(destroyed).to.equal(true);
    expect(exitCodes).to.deep.equal([]);
  });

  it('exits with the provided code when requested', () => {
    lifecycle.finish('扫描完成: 更新 0 个，失败 1 个.', 1);

    expect(exitCodes).to.deep.equal([1]);
  });
});
