#!/usr/bin/env node

import debug from 'debug';
import { Command } from 'commander';
import { transform } from '../lib/transform';
import {
  upgrade,
  upgradeV4,
  upgradeV5,
  upgradeV6,
  upgradeV7,
} from '../lib/upgrade';
import type { TransformOptions } from '../lib/transform-options';

// eslint-disable-next-line no-unused-vars
const log = debug('codemod');
const error = debug('codemod:error');
debug.enable('codemod:*');

const program = new Command();

const addTransformOptions = (command: Command): Command => {
  return command
    .option('-d, --dry', 'Dry run (no changes are made to files)')
    .option('-p, --print', 'Print transformed files to stdout')
    .option('--verbose', 'Show more information about the transform process')
    .option(
      '-j, --jscodeshift <options>',
      'Pass options directly to jscodeshift',
    );
};

addTransformOptions(
  program
    .name('codemod')
    .description('CLI tool for running codemods')
    .argument('<codemod>', 'Codemod to run (e.g., rewrite-framework-imports)')
    .argument('<source>', 'Path to source files or directory to transform'),
).action((codemod, source, options: TransformOptions) => {
  try {
    transform(codemod, source, options);
  } catch (err: any) {
    error(`Error transforming: ${err}`);
    process.exit(1);
  }
});

addTransformOptions(
  program
    .command('upgrade')
    .description('Upgrade ai package dependencies and apply all codemods'),
).action((options: TransformOptions) => {
  try {
    upgrade(options);
  } catch (err: any) {
    error(`Error upgrading: ${err}`);
    process.exit(1);
  }
});

addTransformOptions(
  program.command('v4').description('Apply v4 codemods (v3 → v4 migration)'),
).action((options: TransformOptions) => {
  try {
    upgradeV4(options);
  } catch (err: any) {
    error(`Error applying v4 codemods: ${err}`);
    process.exit(1);
  }
});

addTransformOptions(
  program.command('v5').description('Apply v5 codemods (v4 → v5 migration)'),
).action((options: TransformOptions) => {
  try {
    upgradeV5(options);
  } catch (err: any) {
    error(`Error applying v5 codemods: ${err}`);
    process.exit(1);
  }
});

addTransformOptions(
  program.command('v6').description('Apply v6 codemods (v5 → v6 migration)'),
).action((options: TransformOptions) => {
  try {
    upgradeV6(options);
  } catch (err: any) {
    error(`Error applying v6 codemods: ${err}`);
    process.exit(1);
  }
});

addTransformOptions(
  program.command('v7').description('Apply v7 codemods (v6 → v7 migration)'),
).action((options: TransformOptions) => {
  try {
    upgradeV7(options);
  } catch (err: any) {
    error(`Error applying v7 codemods: ${err}`);
    process.exit(1);
  }
});

program.parse(process.argv);
