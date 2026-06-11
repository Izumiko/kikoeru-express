import { parseArgs } from 'node:util';
import { performUpdate } from '../core/runtime.js';
import type { MetadataUpdateOptions } from '../workers/metadata-updater.js';

type RunUpdateCliOptions = {
  argv?: string[];
  performUpdateFn?: ((options: MetadataUpdateOptions) => Promise<void>) | undefined;
  exit?: ((code: number) => void) | undefined;
};

const parseUpdateOptions = (argv: string[]): MetadataUpdateOptions => {
  const { values } = parseArgs({
    args: argv,
    options: {
      refreshAll: { type: 'boolean', short: 'a' },
      all: { type: 'boolean' },
      includeNSFW: { type: 'boolean', short: 'n' },
      nsfw: { type: 'boolean' },
      includeTags: { type: 'boolean', short: 't' },
      tags: { type: 'boolean' },
      includeVA: { type: 'boolean', short: 'v' },
      vas: { type: 'boolean' },
    },
    strict: false,
  });

  const updateOptions: MetadataUpdateOptions = {};

  if (values.refreshAll || values.all) {
    updateOptions.refreshAll = true;
  } else if (values.includeNSFW || values.nsfw) {
    updateOptions.includeNSFW = true;
  } else if (values.includeTags || values.tags) {
    updateOptions.includeTags = true;
  } else if (values.includeVA || values.vas) {
    updateOptions.includeVA = true;
  }

  return updateOptions;
};

const runUpdateCli = ({
  argv = process.argv.slice(2),
  performUpdateFn = undefined,
  exit = (code) => process.exit(code),
}: RunUpdateCliOptions = {}) =>
  (performUpdateFn ?? performUpdate)(parseUpdateOptions(argv))
    .then(() => {
      exit(0);
    })
    .catch((err) => {
      throw err;
    });

export { parseUpdateOptions, runUpdateCli };
