// @ts-nocheck
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { performUpdate } from './runtime.js';

const createUpdateArgParser = argv =>
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

const buildUpdateOptions = argv => {
  const updateOptions = {};

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

const parseUpdateOptions = argv => buildUpdateOptions(createUpdateArgParser(argv).argv);

const runUpdateCli = ({
  argv = hideBin(process.argv),
  performUpdateFn = null,
  exit = code => process.exit(code),
} = {}) =>
  (performUpdateFn || performUpdate)(parseUpdateOptions(argv))
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
