#!/usr/bin/env node

import 'dotenv/config';

import { configureUnhandledRejectionCrash, startServer } from '../app/server.js';

configureUnhandledRejectionCrash();
startServer();
