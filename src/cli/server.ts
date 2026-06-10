#!/usr/bin/env node
// @ts-nocheck

import 'dotenv/config';

import { configureUnhandledRejectionCrash, startServer } from '../app/server.js';

configureUnhandledRejectionCrash();
startServer();
