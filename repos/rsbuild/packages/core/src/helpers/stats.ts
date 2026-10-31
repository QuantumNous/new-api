import { color } from 'rslog';
import { isVerbose, type Logger } from '../logger';
import type { ActionType, RsbuildStats, Rspack } from '../types';
import { isMultiCompiler } from './compiler';
import { formatStatsError } from './format';

// Ensure the input string ends with a line break
const ensureTrailingNewline = (input: string) =>
  input.replace(/[ \t]+$/, '').endsWith('\n') ? input : `${input}\n`;

function formatErrorMessage(errors: string[]) {
  if (!errors.length) {
    return `Build failed. No errors reported since Rspack's "stats.errors" is disabled.`;
  }

  const title = color.bold(color.red(errors.length > 1 ? 'Build errors: ' : 'Build error: '));
  const text = ensureTrailingNewline(errors.join('\n\n'));
  return `${title}\n${text}`;
}

/**
 * If stats has errors, return stats errors directly
 * If stats has no errors, return child errors, as some errors exist in both
 * stats and childCompiler
 */
export const getStatsErrors = ({ errors, children }: RsbuildStats): Rspack.StatsError[] => {
  if (errors !== undefined && errors.length > 0) {
    return errors;
  }

  if (children) {
    return children.reduce<Rspack.StatsError[]>(
      (errors, ret) => (ret.errors ? errors.concat(ret.errors) : errors),
      [],
    );
  }

  return [];
};

export const getStatsWarnings = ({ warnings, children }: RsbuildStats): Rspack.StatsError[] => {
  if (warnings !== undefined && warnings.length > 0) {
    return warnings;
  }

  if (children) {
    return children.reduce<Rspack.StatsError[]>(
      (warnings, ret) => (ret.warnings ? warnings.concat(ret.warnings) : warnings),
      [],
    );
  }

  return [];
};

function getStatsOptions(
  compiler: Rspack.Compiler | Rspack.MultiCompiler,
  logger: Logger,
  action?: ActionType,
): Rspack.StatsOptions {
  let defaultOptions: Rspack.StatsOptions = {
    all: false,
    // for displaying the build errors
    errors: true,
    // for displaying the build warnings
    warnings: true,
    // for displaying the module trace when build failed
    moduleTrace: true,
    // for displaying the error stack in verbose mode
    errorStack: isVerbose(logger),
  };

  if (action === 'dev') {
    defaultOptions = {
      ...defaultOptions,
      // for HMR to compare the hash
      hash: true,
      // for HMR to compare the entrypoints
      entrypoints: true,
    };
  }

  if (isMultiCompiler(compiler)) {
    return {
      ...defaultOptions,
      children: compiler.compilers.map((compiler) =>
        compiler.options ? compiler.options.stats : undefined,
      ),
    } as unknown as Rspack.StatsOptions;
  }

  const { stats } = compiler.options;

  if (typeof stats === 'string') {
    return { ...defaultOptions, preset: stats };
  }

  if (typeof stats === 'object') {
    return { ...defaultOptions, ...stats };
  }

  return defaultOptions;
}

export function getRsbuildStats(
  statsInstance: Rspack.Stats | Rspack.MultiStats,
  compiler: Rspack.Compiler | Rspack.MultiCompiler,
  logger: Logger,
  action?: ActionType,
): RsbuildStats {
  const statsOptions = getStatsOptions(compiler, logger, action);
  return statsInstance.toJson(statsOptions) as RsbuildStats;
}

export function formatStats(
  stats: RsbuildStats,
  hasErrors: boolean,
  root: string,
  logger: Logger,
): {
  message?: string;
  level?: string;
} {
  if (hasErrors) {
    const errors = getStatsErrors(stats);
    const errorMessages = errors.map((item) => formatStatsError(item, root, 'error', logger));
    return {
      message: formatErrorMessage(errorMessages),
      level: 'error',
    };
  }

  const warnings = getStatsWarnings(stats);
  const warningMessages = warnings.map((item) => formatStatsError(item, root, 'warning', logger));

  if (warningMessages.length) {
    const title = color.bold(
      color.yellow(warningMessages.length > 1 ? 'Build warnings: \n' : 'Build warning: \n'),
    );

    return {
      message: ensureTrailingNewline(`${title}${warningMessages.join('\n\n')}`),
      level: 'warning',
    };
  }

  return {};
}

/**
 * Remove the loader chain delimiter from the module identifier.
 * @example ./src/index.js!=!/node_modules/my-loader/index.js -> ./src/index.js
 */
export const removeLoaderChainDelimiter = (moduleId: string, logger: Logger): string => {
  if (isVerbose(logger)) {
    return moduleId;
  }
  const LOADER_CHAIN_SEPARATOR = '!=!';
  return moduleId.split(LOADER_CHAIN_SEPARATOR)[0];
};
