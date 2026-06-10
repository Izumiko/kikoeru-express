const LimitPromise = require('limit-promise');

const createConcurrencyLimiter = ({ max, LimitPromiseImpl = LimitPromise }) => {
  const limitP = new LimitPromiseImpl(max); // 核心控制器

  /**
   * 限制函数并发数量，
   * 使用控制器包装目标方法，实际上是将请求函数递交给控制器处理。
   */
  const limit = caller => (...args) => limitP.call(caller, ...args);

  return {
    limit,
  };
};

module.exports = {
  createConcurrencyLimiter,
};
