import LimitPromise from 'limit-promise';

type AnyAsyncFunction = (...args: never[]) => Promise<unknown>;

type LimitPromiseController = {
  call<T extends AnyAsyncFunction>(caller: T, ...args: Parameters<T>): ReturnType<T>;
};

type LimitPromiseConstructor = new (max: number) => LimitPromiseController;

type ConcurrencyLimiterOptions = {
  max: number;
  LimitPromiseImpl?: LimitPromiseConstructor;
};

const createConcurrencyLimiter = ({ max, LimitPromiseImpl = LimitPromise as LimitPromiseConstructor }: ConcurrencyLimiterOptions) => {
  const limitP = new LimitPromiseImpl(max); // 核心控制器

  /**
   * 限制函数并发数量，
   * 使用控制器包装目标方法，实际上是将请求函数递交给控制器处理。
   */
  const limit =
    <T extends AnyAsyncFunction>(caller: T) =>
    (...args: Parameters<T>): ReturnType<T> =>
      limitP.call(caller, ...args);

  return {
    limit,
  };
};

export {
  createConcurrencyLimiter,
};
