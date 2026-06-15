declare module 'serve-index' {
  import type { RequestHandler } from 'express';
  function serveIndex(path: string, options?: unknown): RequestHandler;
  export default serveIndex;
}
