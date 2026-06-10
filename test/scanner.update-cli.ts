// @ts-nocheck
import { expect } from 'chai';
import { parseUpdateOptions, runUpdateCli } from '../src/modules/scanner/update-cli.js';

describe('scanner update CLI', () => {
  it('parses refresh options with the legacy precedence', () => {
    expect(parseUpdateOptions(['--refreshAll', '--includeVA'])).to.deep.equal({ refreshAll: true });
    expect(parseUpdateOptions(['--includeNSFW', '--includeTags'])).to.deep.equal({ includeNSFW: true });
    expect(parseUpdateOptions(['--includeTags', '--includeVA'])).to.deep.equal({ includeTags: true });
    expect(parseUpdateOptions(['--includeVA'])).to.deep.equal({ includeVA: true });
    expect(parseUpdateOptions([])).to.deep.equal({});
  });

  it('runs update and exits with zero on success', async () => {
    const calls = {
      updates: [],
      exits: [],
    };

    await runUpdateCli({
      argv: ['--includeVA'],
      performUpdateFn: options => {
        calls.updates.push(options);
        return Promise.resolve();
      },
      exit: code => calls.exits.push(code),
    });

    expect(calls).to.deep.equal({
      updates: [{ includeVA: true }],
      exits: [0],
    });
  });
});
