// @ts-nocheck
const getDefaultTimeout = (url, config) => {
  if (url.indexOf('dlsite') !== -1) {
    return config.dlsiteTimeout || (config.retry || 5);
  }

  if (url.indexOf('hvdb') !== -1) {
    return config.hvdbTimeout || (config.retry || 5);
  }

  return 10000;
};

const buildRetryConfig = (url, requestConfig, appConfig) => {
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

const applyRetryConfig = (url, requestConfig, appConfig) => {
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
