import { expect } from 'vitest';
import { createConcurrencyLimiter } from '../src/modules/scanner/support/concurrency-limiter.js';

describe('createConcurrencyLimiter', () => {
  it('limits concurrent execution to the configured maximum', async () => {
    let running = 0;
    let maxObserved = 0;

    const { limit } = createConcurrencyLimiter({ max: 2 });

    const task = async (id: number) => {
      running++;
      maxObserved = Math.max(maxObserved, running);
      await new Promise((resolve) => setTimeout(resolve, 10));
      running--;
      return id;
    };

    const results = await Promise.all([limit(task)(1), limit(task)(2), limit(task)(3), limit(task)(4)]);

    expect(results).to.deep.equal([1, 2, 3, 4]);
    expect(maxObserved).to.equal(2);
    expect(running).to.equal(0);
  });

  it('returns the result of the wrapped function', async () => {
    const { limit } = createConcurrencyLimiter({ max: 1 });
    const target = (id: number, options: { refreshAll: boolean }) => Promise.resolve({ id, options });

    const result = await limit(target)(123, { refreshAll: true });

    expect(result).to.deep.equal({ id: 123, options: { refreshAll: true } });
  });

  it('propagates errors from the wrapped function', async () => {
    const { limit } = createConcurrencyLimiter({ max: 1 });
    const target = () => Promise.reject(new Error('test error'));

    await expect(limit(target)()).rejects.toThrow('test error');
  });
});
