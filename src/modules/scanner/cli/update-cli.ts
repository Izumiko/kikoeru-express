import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { performUpdate } from '../core/runtime.js';
import type { MetadataUpdateOptions } from '../workers/metadata-updater.js';

type UpdateArgv = {
  refreshAll?: boolean;
  includeNSFW?: boolean;
  includeTags?: boolean;
  includeVA?: boolean;
};

type RunUpdateCliOptions = {
  argv?: string[];
  performUpdateFn?: ((options: MetadataUpdateOptions) => Promise<void>) | undefined;
  exit?: ((code: number) => void) | undefined;
};

const createUpdateArgParser = (argv: string[]) =>
  yargs(argv)
    .option('refreshAll', {
      alias: 'all',
      description: 'Refresh both dynamic and static metadata',
      type: 'boolean',
    })
    .option('includeNSFW', {
      alias: 'nsfw',
      description: 'Refresh dynamic metadata and nsfw field',
      type: 'boolean',
    })
    .option('includeTags', {
      alias: 'tags',
      description: 'Refresh dynamic metadata and tags',
      type: 'boolean',
    })
    .option('includeVA', {
      alias: 'vas',
      description: 'Refresh dynamic metadata and voice actors',
      type: 'boolean',
    });

const buildUpdateOptions = (argv: UpdateArgv): MetadataUpdateOptions => {
  const updateOptions: MetadataUpdateOptions = {};

  if (argv.refreshAll) {
    updateOptions.refreshAll = true;
  } else if (argv.includeNSFW) {
    updateOptions.includeNSFW = true;
  } else if (argv.includeTags) {
    updateOptions.includeTags = true;
  } else if (argv.includeVA) {
    updateOptions.includeVA = true;
  }

  return updateOptions;
};

const parseUpdateOptions = (argv: string[]): MetadataUpdateOptions =>
  buildUpdateOptions(createUpdateArgParser(argv).argv as UpdateArgv);

const runUpdateCli = ({
  argv = hideBin(process.argv),
  performUpdateFn = undefined,
  exit = code => process.exit(code),
}: RunUpdateCliOptions = {}) =>
  (performUpdateFn ?? performUpdate)(parseUpdateOptions(argv))
    .then(() => {
      exit(0);
    })
    .catch(err => {
      throw err;
    });

export {
  buildUpdateOptions,
  parseUpdateOptions,
  runUpdateCli,
};
