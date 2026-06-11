process.env.FREEZE_CONFIG_FILE = 'true';
process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';

Object.assign(globalThis, { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach });
