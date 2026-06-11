import originAxios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { httpsOverHttp, httpOverHttp } from 'tunnel-agent';

import { config } from '../../../config.js';
import { applyRetryConfig } from './retry-config.js';
import type { RetryRequestConfig } from './retry-config.js';
import { createRetryGet } from './retry-client.js';
import type { RetryHttpGet } from './retry-client.js';
const Config = config;

const applyRetryConfigTyped = applyRetryConfig as (
  url: string,
  requestConfig: RetryRequestConfig,
  appConfig: unknown
) => RetryRequestConfig;

type RetryAxiosInstance = AxiosInstance & {
  retryGet: (url: string, requestConfig: RetryRequestConfig) => Promise<AxiosResponse>;
};

type TunnelOptions = {
  proxy: {
    port: number;
    host?: string;
  };
};

const axios = originAxios.create() as RetryAxiosInstance;
// axios.defaults.timeout = Config.timeout || 2000; // 请求超时的毫秒数
// // 拦截请求 (添加自定义默认参数)
// axios.interceptors.request.use(function (config) {
//   config.retry = Config.retry || 5; // 重试次数
//   config.retryDelay = Config.retryDelay || 1000; // 请求间隔的毫秒数
//   return config;
// });

// 代理设置
const TUNNEL_OPTIONS: TunnelOptions = {
  proxy: {
    port: Config.httpProxyPort,
  },
};
if (Config.httpProxyHost) {
  TUNNEL_OPTIONS.proxy.host = Config.httpProxyHost;
}

// 拦截请求 (http 代理)
axios.interceptors.request.use(function (config) {
  if (Config.httpProxyPort) {
    config.proxy = false; // 强制禁用环境变量中的代理配置
    config.httpAgent = httpOverHttp(TUNNEL_OPTIONS);
    config.httpsAgent = httpsOverHttp(TUNNEL_OPTIONS);
  }

  return config;
});

// // 拦截响应 (遇到错误时, 重新发起新请求)
// axios.interceptors.response.use(undefined, function axiosRetryInterceptor(err) {
//   var config = err.config;
//   // If config does not exist or the retry option is not set, reject
//   if(!config || !config.retry) return Promise.reject(err);

//   // Set the variable for keeping track of the retry count
//   config.__retryCount = config.__retryCount || 0;

//   // Check if we've maxed out the total number of retries
//   if(config.__retryCount >= config.retry) {
//     // Reject with the error
//     return Promise.reject(err);
//   }

//   // Increase the retry count
//   config.__retryCount += 1;

//   // Create new promise to handle exponential backoff
//   var backoff = new Promise(function(resolve) {
//     setTimeout(function() {
//         resolve();
//     }, config.retryDelay || 1);
//   });

//   // Return the promise in which recalls axios to retry the request
//   return backoff.then(function() {
//     return axios(config);
//   });
// });

const retryGet = createRetryGet({
  httpGet: ((url: string, requestConfig: RetryRequestConfig) =>
    axios.get(url, requestConfig as AxiosRequestConfig)) as RetryHttpGet,
  cancelTokenSource: () => originAxios.CancelToken.source(),
  applyRetryConfig: applyRetryConfigTyped,
  appConfig: Config,
}) as RetryAxiosInstance['retryGet'];
axios.retryGet = retryGet;

/**
 * 针对 dlsite 的网址转发
 */

export default axios;
