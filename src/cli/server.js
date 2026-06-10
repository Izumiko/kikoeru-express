#!/usr/bin/env node

require('dotenv').config();

const { configureUnhandledRejectionCrash, startServer } = require('../app/server');

configureUnhandledRejectionCrash();
startServer();
