import minimist, { ParsedArgs } from 'minimist';
import { execSync } from 'child_process';
import { RushConfiguration } from '@microsoft/rush-lib';

interface PrettierScriptArgv extends ParsedArgs {
  dir?: string;
  ext?: string;
}

function run() {
  const cwd = process.cwd();
  const rushConfiguration = RushConfiguration.loadFromDefaultLocation({ startingFolder: cwd });

  const argv: PrettierScriptArgv = minimist(process.argv.slice(2));
  const configFilePath = rushConfiguration.rushJsonFolder + '/.prettierrc.js';
  const ignoreFilePath = rushConfiguration.rushJsonFolder + '/.prettierignore';

  let ext = '{ts,tsx,less}';
  if (argv.ext) {
    const length = argv.ext.split(',').length;
    ext = length === 1 ? `${argv.ext}` : `{${argv.ext}}`;
  }

  let patterns = `{apps,libs}/**/src/**/**/*.${ext}`;
  if (argv.dir) {
    patterns = `${argv.dir}/src/**/**/*.${ext}`;
  }

  console.log(patterns);

  execSync(`prettier  --config "${configFilePath}" --ignore-path "${ignoreFilePath}" --write ${patterns}`, {
    stdio: [0, 1, 2]
  });
}

run();
