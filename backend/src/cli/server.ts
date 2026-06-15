#!/usr/bin/env node

import { configureUnhandledRejectionCrash, startServer } from '../app/server.js';

configureUnhandledRejectionCrash();
startServer();
