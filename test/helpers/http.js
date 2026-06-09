/* eslint-disable node/no-unpublished-require */
const http = require('http');

const request = (app, options = {}) =>
  new Promise((resolve, reject) => {
    const server = http.createServer(app);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const headers = Object.assign({}, options.headers);
      let body = options.body;

      if (body && typeof body !== 'string' && !Buffer.isBuffer(body)) {
        body = JSON.stringify(body);
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      }

      if (body) {
        headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: address.port,
          path: options.path || '/',
          method: options.method || 'GET',
          headers,
        },
        res => {
          const chunks = [];

          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            server.close(closeErr => {
              if (closeErr) {
                reject(closeErr);
                return;
              }

              const text = Buffer.concat(chunks).toString('utf8');
              let data = text;

              try {
                data = JSON.parse(text);
              } catch (err) {
                // Keep non-JSON responses as text.
              }

              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                text,
                body: data,
              });
            });
          });
        }
      );

      req.on('error', err => {
        server.close(() => reject(err));
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });
  });

module.exports = { request };
