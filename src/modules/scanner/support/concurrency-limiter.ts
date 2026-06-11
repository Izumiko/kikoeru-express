type AnyAsyncFunction = (...args: never[]) => Promise<unknown>;

type ConcurrencyLimiterOptions = {
  max: number;
};

const createConcurrencyLimiter = ({ max }: ConcurrencyLimiterOptions) => {
  const queue: Array<{ resolve: () => void; reject: (reason?: unknown) => void }> = [];
  let activeCount = 0;

  const next = () => {
    if (queue.length === 0 || activeCount >= max) return;
    activeCount++;
    const { resolve } = queue.shift()!;
    resolve();
  };

  const limit =
    <T extends AnyAsyncFunction>(caller: T) =>
    (...args: Parameters<T>): ReturnType<T> =>
      new Promise((resolve, reject) => {
        const run = async () => {
          try {
            const result = await caller(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            activeCount--;
            next();
          }
        };

        if (activeCount < max) {
          activeCount++;
          run();
        } else {
          queue.push({ resolve: run, reject });
        }
      }) as ReturnType<T>;

  return { limit };
};

export { createConcurrencyLimiter };
