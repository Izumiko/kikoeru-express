// @ts-nocheck
import { expect } from 'chai';
import { SOCKET_EVENTS } from '../src/modules/socket/events.js';

describe('socket event contract', () => {
  it('keeps the legacy scanner event names stable', () => {
    expect(SOCKET_EVENTS).to.deep.equal({
      KILL_SCAN_PROCESS: 'KILL_SCAN_PROCESS',
      ON_SCANNER_PAGE: 'ON_SCANNER_PAGE',
      PERFORM_SCAN: 'PERFORM_SCAN',
      PERFORM_UPDATE: 'PERFORM_UPDATE',
      SCAN_ERROR: 'SCAN_ERROR',
      SCAN_FAILED_TASKS: 'SCAN_FAILED_TASKS',
      SCAN_FINISHED: 'SCAN_FINISHED',
      SCAN_INIT_STATE: 'SCAN_INIT_STATE',
      SCAN_MAIN_LOGS: 'SCAN_MAIN_LOGS',
      SCAN_RESULTS: 'SCAN_RESULTS',
      SCAN_TASKS: 'SCAN_TASKS',
      SUCCESS: 'success',
    });
  });
});
