declare module 'serve-index' {
  import type { RequestHandler } from 'express';
  function serveIndex(path: string, options?: unknown): RequestHandler;
  export default serveIndex;
}

declare module 'limit-promise' {
  class LimitPromise {
    constructor(maxConcurrency: number);
    call<T>(fn: (...args: unknown[]) => T | Promise<T>, ...args: unknown[]): Promise<T>;
  }
  export default LimitPromise;
}

declare module 'tunnel-agent' {
  export function httpOverHttp(options?: unknown): unknown;
  export function httpOverHttps(options?: unknown): unknown;
  export function httpsOverHttp(options?: unknown): unknown;
  export function httpsOverHttps(options?: unknown): unknown;
}
