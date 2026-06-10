// @ts-nocheck
const createDelay = (setTimeoutFn = setTimeout) => ms => new Promise(resolve => setTimeoutFn(resolve, ms));

const getRetryUrl = (error, fallbackUrl) =>
  // error.request._currentRequest.path 是请求被转发后的地址，重试时优先复用它。
  error.request && error.request._currentRequest && error.request._currentRequest.path
    ? error.request._currentRequest.path
    : fallbackUrl;

const createRetryGet = ({
  httpGet,
  cancelTokenSource,
  applyRetryConfig,
  appConfig,
  delay = createDelay(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  consoleLogger = console,
}) => {
  const retryGet = async (url, requestConfig) => {
    applyRetryConfig(url, requestConfig, appConfig);

    const abort = cancelTokenSource();
    const timeoutId = setTimeoutFn(
      () => abort.cancel(`Timeout of ${requestConfig.retry.timeout}ms.`),
      requestConfig.retry.timeout
    );
    requestConfig.cancelToken = abort.token;

    try {
      const response = await httpGet(url, requestConfig);
      clearTimeoutFn(timeoutId);
      return response;
    } catch (error) {
      if (requestConfig.retry.retryCount < requestConfig.retry.limit && !error.response) {
        requestConfig.retry.retryCount += 1;
        await delay(requestConfig.retry.retryDelay);
        consoleLogger.log(`${url} 第 ${requestConfig.retry.retryCount} 次重试请求`);
        return retryGet(getRetryUrl(error, url), requestConfig);
      }

      throw error;
    }
  };

  return retryGet;
};

export {
  createDelay,
  createRetryGet,
  getRetryUrl,
};
