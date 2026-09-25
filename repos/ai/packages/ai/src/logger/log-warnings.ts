import type { Warning } from '../types';

/**
 * A function for logging warnings.
 *
 * You can assign it to the `AI_SDK_LOG_WARNINGS` global variable to use it as the default warning logger.
 *
 * @example
 * ```ts
 * globalThis.AI_SDK_LOG_WARNINGS = (options) => {
 *   console.log('WARNINGS:', options.warnings, options.provider, options.model);
 * };
 * ```
 */
export type LogWarningsFunction = (options: {
  /**
   * The warnings returned by the model provider.
   */
  warnings: Warning[];

  /**
   * The provider id used for the call, if scoped to a specific provider.
   */
  provider?: string;

  /**
   * The model id used for the call, if scoped to a specific provider.
   */
  model?: string;
}) => void;

/**
 * Formats a warning object into a human-readable string with clear AI SDK branding.
 *
 * @param options - The options for formatting the warning.
 * @param options.warning - The warning to format.
 * @param options.provider - The provider id used for the call, if scoped to a specific provider.
 * @param options.model - The model id used for the call, if scoped to a specific provider.
 * @returns A formatted warning message string.
 */
function formatWarning({
  warning,
  provider,
  model,
}: {
  warning: Warning;
  provider?: string;
  model?: string;
}): string {
  const scope =
    provider != null && model != null ? ` (${provider} / ${model})` : '';
  const prefix = `AI SDK Warning${scope}:`;

  switch (warning.type) {
    case 'unsupported': {
      let message = `${prefix} The feature "${warning.feature}" is not supported.`;
      if (warning.details) {
        message += ` ${warning.details}`;
      }
      return message;
    }

    case 'compatibility': {
      let message = `${prefix} The feature "${warning.feature}" is used in a compatibility mode.`;
      if (warning.details) {
        message += ` ${warning.details}`;
      }
      return message;
    }

    case 'deprecated': {
      return `${prefix} Deprecated: "${warning.setting}". ${warning.message}`;
    }

    case 'other': {
      return `${prefix} ${warning.message}`;
    }

    default: {
      // Fallback for any unknown warning types
      return `${prefix} ${JSON.stringify(warning, null, 2)}`;
    }
  }
}

export const FIRST_WARNING_INFO_MESSAGE =
  'AI SDK Warning System: To turn off warning logging, set the AI_SDK_LOG_WARNINGS global to false.';

let hasLoggedBefore = false;

/**
 * Logs warnings to the console or uses a custom logger if configured.
 *
 * The behavior can be customized via the `AI_SDK_LOG_WARNINGS` global variable:
 * - If set to `false`, warnings are suppressed.
 * - If set to a function, that function is called with the warnings.
 * - Otherwise, warnings are logged to the console using `console.warn`.
 *
 * @param options - The options containing warnings and context.
 * @param options.warnings - The warnings to log.
 * @param options.provider - The provider id used for the call, if scoped to a specific provider.
 * @param options.model - The model id used for the call, if scoped to a specific provider.
 */
export const logWarnings: LogWarningsFunction = options => {
  // if the warnings array is empty, do nothing
  if (options.warnings.length === 0) {
    return;
  }

  const logger = globalThis.AI_SDK_LOG_WARNINGS;

  // if the logger is set to false, do nothing
  if (logger === false) {
    return;
  }

  // use the provided logger if it is a function
  if (typeof logger === 'function') {
    logger(options);
    return;
  }

  // display information note on first call
  if (!hasLoggedBefore) {
    hasLoggedBefore = true;
    console.info(FIRST_WARNING_INFO_MESSAGE);
  }

  // default behavior: log warnings via process.emitWarning if available, otherwise console.warn
  for (const warning of options.warnings) {
    const message = formatWarning({
      warning,
      provider: options.provider,
      model: options.model,
    });
    if (
      typeof process !== 'undefined' &&
      typeof process.emitWarning === 'function'
    ) {
      process.emitWarning(message, {
        type: warning.type === 'deprecated' ? 'DeprecationWarning' : 'Warning',
      });
    } else {
      console.warn(message);
    }
  }
};

/**
 * Resets the internal logging state. Used for testing purposes.
 */
export const resetLogWarningsState = () => {
  hasLoggedBefore = false;
};
