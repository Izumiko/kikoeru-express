import type { AppConfig } from '../../config/types.js';

export type RetryState = {
  limit: number;
  retryCount: number;
  retryDelay: number;
  timeout: number;
};

export type RetryRequestConfig = {
  retry?: Partial<RetryState>;
  proxy?: boolean;
  timeout?: number;
  cancelToken?: unknown;
  headers?: Record<string, unknown>;
  responseType?: string;
  [key: string]: unknown;
};

type RetryAppConfig = Pick<AppConfig, 'dlsiteTimeout' | 'hvdbTimeout' | 'retry' | 'retryDelay'>;

const getDefaultTimeout = (url: string, config: Partial<RetryAppConfig>): number => {
  if (url.indexOf('dlsite') !== -1) {
    return config.dlsiteTimeout || (config.retry || 5);
  }

  if (url.indexOf('hvdb') !== -1) {
    return config.hvdbTimeout || (config.retry || 5);
  }

  return 10000;
};

const buildRetryConfig = (
  url: string,
  requestConfig: RetryRequestConfig,
  appConfig: Partial<RetryAppConfig>
): RetryState => {
  const defaultLimit = appConfig.retry || 5;
  const defaultRetryDelay = appConfig.retryDelay || 2000;
  const defaultTimeout = getDefaultTimeout(url, appConfig);
  const retry = requestConfig.retry || {};

  return {
    limit: retry.limit || defaultLimit,
    retryCount: retry.retryCount || 0,
    retryDelay: retry.retryDelay || defaultRetryDelay,
    timeout: retry.timeout || defaultTimeout,
  };
};

const applyRetryConfig = (
  url: string,
  requestConfig: RetryRequestConfig,
  appConfig: Partial<RetryAppConfig>
): RetryRequestConfig => {
  if (url.indexOf('hvdb') !== -1) {
    requestConfig.proxy = false;
  }

  requestConfig.retry = buildRetryConfig(url, requestConfig, appConfig);
  return requestConfig;
};

export {
  applyRetryConfig,
  buildRetryConfig,
  getDefaultTimeout,
};
