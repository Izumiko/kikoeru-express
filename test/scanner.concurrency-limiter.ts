import { expect } from 'vitest';
import { createConcurrencyLimiter } from '../src/modules/scanner/support/concurrency-limiter.js';

describe('createConcurrencyLimiter', () => {
  it('wraps functions with the configured concurrency controller', async () => {
    const calls = [];

    class FakeLimitPromise {
      constructor(max) {
        calls.push({ type: 'constructor', max });
      }

      call(caller, ...args) {
        calls.push({ type: 'call', caller, args });
        return caller(...args);
      }
    }

    const { limit } = createConcurrencyLimiter({
      max: 3,
      LimitPromiseImpl: FakeLimitPromise,
    });
    const target = (id, options) => Promise.resolve({ id, options });

    const result = await limit(target)(123, { refreshAll: true });

    expect(result).to.deep.equal({ id: 123, options: { refreshAll: true } });
    expect(calls).to.deep.equal([
      { type: 'constructor', max: 3 },
      { type: 'call', caller: target, args: [123, { refreshAll: true }] },
    ]);
  });
});
