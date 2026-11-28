import { rspack, type WatchOptions } from '@rspack/core';
import { createCompiler } from './createCompiler';
import { registerBuildHook } from './hooks';
import type { InitConfigsOptions } from './initConfigs';
import type { Build, BuildOptions, Rspack } from './types';

export const RSPACK_BUILD_ERROR = 'Rspack build failed.';

export const build = async (
  initOptions: InitConfigsOptions,
  { watch }: BuildOptions = {},
): Promise<ReturnType<Build>> => {
  const { context } = initOptions;
  const { logger } = context;
  const { compiler, rspackConfigs } = await createCompiler(initOptions);

  registerBuildHook({
    context,
    rspackConfigs,
    compiler,
    isWatch: Boolean(watch),
    MultiStatsCtor: rspack.MultiStats,
  });

  if (watch) {
    const watchOptions: WatchOptions[] = rspackConfigs.map((options) => options.watchOptions || {});

    compiler.watch(watchOptions.length > 1 ? watchOptions : watchOptions[0] || {}, (err) => {
      if (err) {
        logger.error(err);
      }
    });

    return {
      close: () =>
        new Promise((resolve) => {
          compiler.close(() => {
            resolve();
          });
        }),
    };
  }

  const { stats } = await new Promise<{
    stats?: Rspack.Stats | Rspack.MultiStats;
  }>((resolve, reject) => {
    compiler.run((err, stats) => {
      // When using run or watch, call close and wait for it to finish before calling run or watch again.
      // Concurrent compilations will corrupt the output files.
      compiler.close((closeErr) => {
        if (closeErr) {
          logger.error('Failed to close compiler: ', closeErr);
        }

        if (err) {
          reject(err);
        } else if (context.buildState.hasErrors) {
          reject(new Error(RSPACK_BUILD_ERROR));
        } else {
          resolve({ stats });
        }
      });
    });
  });

  return {
    stats,
    close: async () => {},
  };
};
