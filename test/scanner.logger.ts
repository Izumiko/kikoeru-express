// @ts-nocheck
import { expect } from 'chai';
import { ScannerLogger } from '../src/modules/scanner/logger.js';
import { ScanSession } from '../src/modules/scanner/session.js';

describe('ScannerLogger', () => {
  let events;
  let consoleOutput;
  let session;
  let logger;

  beforeEach(() => {
    events = [];
    consoleOutput = [];
    session = new ScanSession(event => events.push(JSON.parse(JSON.stringify(event))));
    logger = new ScannerLogger(session, {
      log: message => consoleOutput.push(message),
    });
  });

  it('emits main logs with the legacy default truncation', () => {
    logger.emitMainLog(' * started');

    expect(consoleOutput).to.deep.equal([' * started']);
    expect(events).to.deep.equal([
      {
        event: 'SCAN_MAIN_LOGS',
        payload: {
          mainLogs: [{ level: 'info', message: 'started' }],
        },
      },
    ]);
  });

  it('emits task logs with the legacy default truncation', () => {
    session.addTask('RJ000123');
    logger.emitTaskLog(' -> [RJ000123] running', 'RJ000123', 'error');

    expect(consoleOutput).to.deep.equal([' -> [RJ000123] running']);
    expect(events).to.deep.equal([
      {
        event: 'SCAN_TASKS',
        payload: {
          tasks: [
            {
              rjcode: 'RJ000123',
              result: null,
              logs: [{ level: 'error', message: 'running' }],
            },
          ],
        },
      },
    ]);
  });
});
