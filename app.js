#!/usr/bin/env node

require('dotenv').config();

const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');

// Crash the process on "unhandled promise rejection" when NODE_ENV=test or CRASH_ON_UNHANDLED exists
if (process.env.NODE_ENV === 'test' || process.env.CRASH_ON_UNHANDLED) {
  process.on('unhandledRejection', (reason, promise) => {
    console.error(new Date().toJSON(), 'Kikoeru log: Unhandled rejection at ', promise, `reason: ${reason}`);
    console.error('Crashing the process because of NODE_ENV or CRASH_ON_UNHANDLED settings');
    process.exit(1);
  });
}

const { initApp } = require('./database/init');
const initSocket = require('./socket');
const { config } = require('./config');
const { createApp } = require('./app-factory');
const app = createApp();

// Initialize database if not exists
// Init or migrate database and config
// Note: non-blocking
initApp().catch(err => console.error(err));

// Create HTTP and HTTPS server
const server = http.createServer(app);
let httpsServer = null;
let httpsSuccess = false;
if (config.httpsEnabled) {
  try {
    httpsServer = https.createServer(
      {
        key: fs.readFileSync(config.httpsPrivateKey),
        cert: fs.readFileSync(config.httpsCert),
      },
      app
    );
    httpsSuccess = true;
  } catch (err) {
    console.error('HTTPS服务器启动失败，请检查证书位置以及是否文件可读');
    console.error(err);
  }
}

// websocket 握手依赖 http 服务
initSocket(server);
if (config.httpsEnabled) {
  initSocket(httpsServer);
}

const listenPort = process.env.PORT || config.listenPort || 8888;
const localOnly = config.blockRemoteConnection;

// Note: for some unknown reasons, :: does not always work
localOnly ? server.listen(listenPort, 'localhost') : server.listen(listenPort);
if (config.httpsEnabled && httpsSuccess) {
  localOnly ? httpsServer.listen(config.httpsPort, 'localhost') : httpsServer.listen(config.httpsPort);
}

server.on('listening', () => {
  console.log('Express server started on port %s at %s', server.address().port, server.address().address);
  const nets = localOnly ? [] : os.networkInterfaces();
  console.log('Your machine IP address:');
  [
    ...Object.values(nets),
    [
      {
        address: 'localhost',
        family: 'IPv4',
        internal: false,
      },
    ],
  ].forEach(ifaces => {
    ifaces.forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(' - http://%s:%s', iface.address, server.address().port);
      }
    });
  });

  console.log('Local Web UI accessible at: http://localhost:%s', server.address().port);
});

if (config.httpsEnabled && httpsSuccess) {
  httpsServer.on('listening', () => {
    console.log('Express server started on port %s at %s', httpsServer.address().port, httpsServer.address().address);
    const nets = localOnly ? [] : os.networkInterfaces();
    console.log('Your machine IP address:');
    [
      ...Object.values(nets),
      [
        {
          address: 'localhost',
          family: 'IPv4',
          internal: false,
        },
      ],
    ].forEach(ifaces => {
      ifaces.forEach(iface => {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(' - https://%s:%s', iface.address, httpsServer.address().port);
        }
      });
    });
  });

  console.log('Local Web UI accessible at: https://localhost:%s', httpsServer.address().port);
}
