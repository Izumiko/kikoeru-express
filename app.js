#!/usr/bin/env node

require('dotenv').config();

const { configureUnhandledRejectionCrash, startServer } = require('./src/app/server');

configureUnhandledRejectionCrash();
startServer();
