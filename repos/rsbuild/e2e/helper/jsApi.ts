import assert from 'node:assert';
import { join } from 'node:path';
import { stripVTControlCharacters as stripAnsi } from 'node:util';
import {
  type CreateRsbuildOptions,
  createRsbuild,
  type BuildResult as RsbuildBuildResult,
  type RsbuildConfig,
  type RsbuildDevServer,
  type RsbuildInstance,
} from '@rsbuild/core';
import { getRandomPort, toPosixPath } from '@rstackjs/test-utils';
import type { Page } from 'playwright';
import type { LogHelper } from './logs.ts';
import { gotoPage, noop } from './utils.ts';

const updateConfigForTest = async (originalConfig: RsbuildConfig, cwd: string = process.cwd()) => {
  const { loadConfig, mergeRsbuildConfig } = await import('@rsbuild/core');
  const { content: loadedConfig } = await loadConfig({
    cwd,
  });

  const baseConfig: RsbuildConfig = {
    server: {
      // make port random to avoid conflict
      port: await getRandomPort(),
    },
    performance: {
      buildCache: false,
    },
  };

  const mergedConfig = mergeRsbuildConfig(baseConfig, loadedConfig, originalConfig);

  return mergedConfig;
};

const filterSourceMaps = (distFiles: Record<string, string>) => {
  return Object.entries(distFiles).reduce(
    (acc, [key, value]) => {
      if (key.endsWith('.map')) {
        return acc;
      }
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>,
  );
};

const collectOutputFiles = (rsbuild: RsbuildInstance) => {
  let outputFiles: Record<string, string> = {};

  const reset = () => {
    outputFiles = {};
  };

  rsbuild.onBeforeBuild(reset);
  rsbuild.onBeforeStartDevServer(reset);

  rsbuild.onAfterCreateCompiler(({ compiler }) => {
    const compilers = 'compilers' in compiler ? compiler.compilers : [compiler];
    for (const compiler of compilers) {
      compiler.hooks.emit.tap('CollectAssetsPlugin', (compilation) => {
        for (const asset of compilation.getAssets()) {
          // skip inlined assets
          if (!asset.source) {
            continue;
          }
          const outputPath = compilation.options.output.path;
          const assetPath = toPosixPath(outputPath ? join(outputPath, asset.name) : asset.name);
          outputFiles[assetPath] = asset.source.source().toString();
        }
      });
    }
  });

  return () => outputFiles;
};

export type DevOptions = CreateRsbuildOptions & {
  logHelper?: LogHelper;
  config?: RsbuildConfig;
  /**
   * Playwright Page instance.
   * This method will automatically goto the page.
   */
  page?: Page;
  /**
   * The done of `dev` does not mean the compile is done.
   * If your test relies on the completion of compilation you should `waitFirstCompileDone`
   * @default true
   */
  waitFirstCompileDone?: boolean;
};

/**
 * Start the dev server and return the server instance.
 */
export async function dev({
  page,
  waitFirstCompileDone = true,
  logHelper,
  ...options
}: DevOptions = {}) {
  process.env.NODE_ENV = 'development';

  options.config = await updateConfigForTest(options.config || {}, options.cwd);

  const rsbuild = await createRsbuild(options);
  const getOutputFiles = collectOutputFiles(rsbuild);

  const wait = waitFirstCompileDone
    ? new Promise<void>((resolve) => {
        rsbuild.onAfterDevCompile(({ isFirstCompile }) => {
          if (!isFirstCompile) {
            return;
          }
          resolve();
        });
      })
    : Promise.resolve();

  let server: RsbuildDevServer | undefined;
  rsbuild.onBeforeStartDevServer((context) => {
    server = context.server;
  });

  const result = await rsbuild.startDevServer();

  await wait;

  if (page) {
    await gotoPage(page, result);
  }

  const { distPath } = rsbuild.context;

  return {
    ...result,
    ...logHelper!,
    distPath,
    server,
    instance: rsbuild,
    getDistFiles: ({ sourceMaps }: { sourceMaps?: boolean } = {}) =>
      sourceMaps ? getOutputFiles() : filterSourceMaps(getOutputFiles()),
    close: async () => {
      await result.server.close();
    },
  };
}

export type BuildOptions = CreateRsbuildOptions & {
  logHelper?: LogHelper;
  config?: RsbuildConfig;
  /**
   * Whether to catch the build error.
   * @default false
   */
  catchBuildError?: boolean;
  /**
   * Whether to run the server.
   * @default false
   */
  runServer?: boolean;
  /**
   * Playwright Page instance.
   * This method will automatically run the server and goto the page.
   */
  page?: Page;
  /**
   * Whether to watch files.
   */
  watch?: boolean;
};

/**
 * Build the project and return the build result.
 */
export async function build({
  catchBuildError = false,
  runServer = false,
  watch = false,
  page,
  logHelper,
  ...options
}: BuildOptions = {}) {
  process.env.NODE_ENV = 'production';

  options.config = await updateConfigForTest(options.config || {}, options.cwd);

  const rsbuild = await createRsbuild(options);
  const getOutputFiles = collectOutputFiles(rsbuild);

  let buildError: Error | undefined;
  let buildResult: RsbuildBuildResult | undefined;

  try {
    buildResult = await rsbuild.build({ watch });
  } catch (error) {
    buildError = error as Error;
    buildError.message = stripAnsi(buildError.message);

    if (!catchBuildError) {
      throw buildError;
    }
  }

  const { distPath } = rsbuild.context;

  let port = 0;
  let server = { close: noop };

  if (runServer || page) {
    const result = await rsbuild.preview();
    port = result.port;
    server = result.server;
  }

  const getIndexBundle = async () => {
    const [name, content] =
      Object.entries(getOutputFiles()).find(
        ([file]) => file.includes('index') && file.endsWith('.js'),
      ) || [];
    assert(name && content);
    return content;
  };

  if (page) {
    await gotoPage(page, { port });
  }

  return {
    ...logHelper!,
    distPath,
    port,
    stats: buildResult?.stats,
    close: async () => {
      await buildResult?.close();
      await server.close();
    },
    buildError,
    getDistFiles: ({ sourceMaps }: { sourceMaps?: boolean } = {}) =>
      sourceMaps ? getOutputFiles() : filterSourceMaps(getOutputFiles()),
    getIndexBundle,
    instance: rsbuild,
  };
}

export type Build = typeof build;
export type BuildResult = Awaited<ReturnType<Build>>;
export type Dev = typeof dev;
export type DevResult = Awaited<ReturnType<Dev>>;
