import minimist, { ParsedArgs } from 'minimist';
import { RushConfiguration } from '@microsoft/rush-lib';
import { execSync } from 'child_process';

interface RunScriptArgv extends ParsedArgs {
  project?: string;
  script?: string;
}

function run() {
  const argv: RunScriptArgv = minimist(process.argv.slice(2));
  const projects = RushConfiguration.loadFromDefaultLocation({
    startingFolder: process.cwd()
  });

  const targetProject = projects.findProjectByShorthandName(argv.project!);

  if (targetProject) {
    try {
      execSync(`rushx ${argv.script}`, {
        cwd: targetProject?.projectFolder,
        stdio: [0, 1, 2]
      });
    } catch (e) {
      console.error(`Encountered error: ${e}`);
    }
  }
}

run();
