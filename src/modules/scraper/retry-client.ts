import type { RetryRequestConfig, RetryState } from './retry-config.js';

type CancelTokenSource = {
  token: unknown;
  cancel: (message: string) => void;
};

type RetryHttpResponse = unknown;

type RetryHttpGet = (url: string, requestConfig: RetryRequestConfig) => Promise<RetryHttpResponse>;

type RetryError = {
  response?: unknown;
  request?: {
    _currentRequest?: {
      path?: string;
    };
  };
};

type TimeoutHandle = ReturnType<typeof setTimeout>;

type RetryGetFactoryOptions = {
  httpGet: RetryHttpGet;
  cancelTokenSource: () => CancelTokenSource;
  applyRetryConfig: (url: string, requestConfig: RetryRequestConfig, appConfig: unknown) => RetryRequestConfig;
  appConfig: unknown;
  delay?: (ms: number) => Promise<void>;
  setTimeoutFn?: (fn: () => void, ms: number) => TimeoutHandle;
  clearTimeoutFn?: (handle: TimeoutHandle) => void;
  consoleLogger?: Pick<Console, 'log'>;
};

type RetryGet = (url: string, requestConfig: RetryRequestConfig) => Promise<RetryHttpResponse>;

const createDelay =
  (setTimeoutFn: (fn: () => void, ms: number) => TimeoutHandle = setTimeout) =>
  (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeoutFn(resolve, ms));

const getRetryUrl = (error: RetryError, fallbackUrl: string): string =>
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
}: RetryGetFactoryOptions): RetryGet => {
  const retryGet: RetryGet = async (url, requestConfig) => {
    applyRetryConfig(url, requestConfig, appConfig);
    const retry = requestConfig.retry as RetryState;

    const abort = cancelTokenSource();
    const timeoutId = setTimeoutFn(() => abort.cancel(`Timeout of ${retry.timeout}ms.`), retry.timeout);
    requestConfig.cancelToken = abort.token;

    try {
      const response = await httpGet(url, requestConfig);
      clearTimeoutFn(timeoutId);
      return response;
    } catch (error) {
      const retryError = error as RetryError;
      if (retry.retryCount < retry.limit && !retryError.response) {
        retry.retryCount += 1;
        await delay(retry.retryDelay);
        consoleLogger.log(`${url} 第 ${retry.retryCount} 次重试请求`);
        return retryGet(getRetryUrl(retryError, url), requestConfig);
      }

      throw error;
    }
  };

  return retryGet;
};

export { createDelay, createRetryGet, getRetryUrl };
export type { RetryHttpGet };
