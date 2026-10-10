import type { RspackOptionsNormalized } from '@rspack/core';

export type RunnerRequirer = (
  currentDirectory: string,
  modulePath: string[] | string,
  context?: {
    file?: BasicRunnerFile;
    esmMode?: EsmMode;
  },
) => unknown | Promise<unknown>;

export type BasicRunnerFile = {
  path: string;
  content: string;
  subPath: string;
};

export enum EsmMode {
  Unknown = 0,
  Evaluated = 1,
  Unlinked = 2,
}

export interface BasicModuleScope {
  console: Console;
  [key: string]: unknown;
}

export interface BasicGlobalContext {
  console: Console;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
  [key: string]: unknown;
}

export type ModuleObject = { exports: unknown };

export type CompilerOptions = RspackOptionsNormalized;

export interface Runner {
  run(file: string): Promise<unknown>;
  getRequire(): RunnerRequirer;
}

export type RunnerFactoryOptions = {
  dist: string;
  compilerOptions: CompilerOptions;
  readFileSync: (path: string) => string;
  isBundleOutput: (modulePath: string) => boolean;
};

export interface RunnerFactory {
  create(options: RunnerFactoryOptions): Runner;
}
