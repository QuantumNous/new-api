import path from 'path';
import chalk from 'chalk';
import minimist, { ParsedArgs } from 'minimist';
import { execSync } from 'child_process';

interface RunScriptArgv extends ParsedArgs {
  message?: string;
  type?: string;
  'not-commit'?: boolean;
}

function run() {
  const commitLineConfigPath = path.resolve(__dirname, './commitlint.config.js');
  const commitLintBinPath = path.resolve(__dirname, './node_modules/.bin/commitlint');
  const argv: RunScriptArgv = minimist(process.argv.slice(2));
  let message = argv.message;
  let bumpType = argv.type;
  let notCommit = argv['not-commit'];

  if (!message) {
    const lastCommitMessage = execSync('git log -1 --pretty=%B ').toString();

    if (!lastCommitMessage) {
      process.exit(1);
    }

    console.log(
      chalk.green(
        `[Notice] no message is supplied, we'll use latest commit message: ${chalk.red.bold(lastCommitMessage)}`
      )
    );
    message = lastCommitMessage;
  } else {
    try {
      execSync(`echo ${message} | "${commitLintBinPath}" --config "${commitLineConfigPath}"`, {
        stdio: 'inherit'
      });
    } catch (e) {
      console.error(`encountered error: ${e}`);
    }
  }

  if (!bumpType) {
    console.log(
      chalk.green(`[Notice] no bumpType is supplied, we'll use default bumpType: ${chalk.red.bold('patch')}`)
    );
    bumpType = 'patch';
  }

  execSync(`rush change --bulk --bump-type '${bumpType}' --message '${message}'`, {
    stdio: 'inherit'
  });

  if (!notCommit) {
    execSync('git add --all', {
      stdio: 'inherit'
    });

    execSync(`git commit -m 'docs: update changlog of rush'`, {
      stdio: 'inherit'
    });
  }
}

run();
