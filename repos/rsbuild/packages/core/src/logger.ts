/**
 * The default logger exported from this module is mainly for CLI/bootstrap
 * scenarios and backwards compatibility. When writing core runtime code,
 * prefer `context.logger` or `api.logger` so logs stay scoped to the current
 * Rsbuild instance.
 *
 * Logging message case convention:
 *
 * Info, ready, success and debug messages:
 * - Start with lowercase
 * - Example: "info  build started..."
 *
 * Errors and warnings:
 * - Start with uppercase
 * - Example: "error  Failed to build"
 *
 * This convention helps distinguish between normal operations
 * and important alerts that require attention.
 */

import {
  color,
  createLogger as baseCreateLogger,
  type Logger,
  logger as defaultLogger,
} from 'rslog';

export const isDebug = (): boolean => {
  if (!process.env.DEBUG) {
    return false;
  }

  const values = process.env.DEBUG.toLocaleLowerCase().split(',');
  return ['rsbuild', 'builder', '*'].some((key) => values.includes(key));
};

export const isVerbose = (targetLogger: Pick<Logger, 'level'>): boolean =>
  targetLogger.level === 'verbose';

// setup the logger level
if (isDebug()) {
  defaultLogger.level = 'verbose';
}

function getTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
}

function applyDebugOverride(targetLogger: Logger) {
  targetLogger.override({
    debug: (message, ...args) => {
      if (targetLogger.level !== 'verbose') {
        return;
      }
      const time = color.gray(getTime());
      const loggerConsole = targetLogger.options.console ?? console;
      loggerConsole.log(`  ${color.magenta('rsbuild')} ${time} ${message}`, ...args);
    },
  });
}

applyDebugOverride(defaultLogger);

export const createLogger = (
  ...args: Parameters<typeof baseCreateLogger>
): ReturnType<typeof baseCreateLogger> => {
  const instance = baseCreateLogger(...args);

  if (isDebug() && args[0]?.level === undefined) {
    instance.level = 'verbose';
  }

  applyDebugOverride(instance);

  return instance;
};

export { defaultLogger };
export type { Logger };
