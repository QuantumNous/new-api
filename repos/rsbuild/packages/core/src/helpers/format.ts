import { builtinModules } from 'node:module';
import { sep } from 'node:path';
import { stripVTControlCharacters as stripAnsi } from 'node:util';
import type { StatsError } from '@rspack/core';
import { color } from 'rslog';
import { LAZY_COMPILATION_IDENTIFIER } from '../constants';
import { isVerbose, type Logger } from '../logger';
import { removeLoaderChainDelimiter } from './stats';

const formatFileName = (fileName: string, stats: StatsError, root: string) => {
  // File name may be empty when the error is not related to a file.
  // For example, when an invalid entry is provided.
  if (!fileName) {
    return '';
  }

  // Handle data-uri virtual modules
  const DATA_URI_PREFIX = 'data:text/javascript,';
  if (fileName.startsWith(DATA_URI_PREFIX)) {
    let snippet = fileName.replace(DATA_URI_PREFIX, '');
    if (snippet.length > 30) {
      snippet = `${snippet.slice(0, 30)}...`;
    }
    return `File: ${color.cyan('data-uri virtual module')} ${color.dim(`(${snippet})`)}\n`;
  }

  // Try to shorten absolute paths by replacing the project root prefix with "./".
  // This improves readability. For example:
  // "/Users/path/to/project/src/App.jsx" → "./src/App.jsx"
  const prefix = root + sep;
  if (fileName.startsWith(prefix)) {
    fileName = fileName.replace(prefix, `.${sep}`);
  }

  if (/:\d+:\d+/.test(fileName)) {
    return `File: ${color.cyan(fileName)}\n`;
  }
  if (stats.loc) {
    return `File: ${color.cyan(`${fileName}:${stats.loc}`)}\n`;
  }

  // Add default column and lines for linking
  return `File: ${color.cyan(`${fileName}:1:1`)}\n`;
};

function resolveFileName(stats: StatsError, logger: Logger) {
  const file =
    // `file` is a custom file path related to the stats error. For example,
    // ts-checker-rspack-plugin sets the module path of type errors to this field.
    // It should be output first as it provides the most specific error location.
    stats.file ||
    // `moduleName` is the readable relative path of the source file
    // e.g. "./src/App.jsx"
    stats.moduleName;

  if (file) {
    return removeLoaderChainDelimiter(file, logger);
  }

  // `moduleIdentifier` is the absolute path with inline loaders
  // e.g. "builtin:react-refresh-loader!/Users/x/src/App.jsx"
  if (stats.moduleIdentifier) {
    const regex = /(?:!|^)([^!]+)$/;
    const matched = stats.moduleIdentifier.match(regex);
    if (matched) {
      const fileName = matched.pop();
      if (fileName) {
        return removeLoaderChainDelimiter(fileName, logger);
      }
    }
  }

  return '';
}

/**
 * Format the module trace, the output be like:
 * Import traces (entry → error):
 *   ./src/index.tsx
 *   ./src/App.tsx
 *   … (n hidden)
 *   ./src/Foo.tsx
 *   ./src/Bar.tsx ×
 */
function formatModuleTrace(
  stats: StatsError,
  errorFile: string,
  level: 'error' | 'warning',
  logger: Logger,
) {
  if (!stats.moduleTrace) {
    return;
  }

  const moduleNames = stats.moduleTrace
    .map((trace) => trace.originName && removeLoaderChainDelimiter(trace.originName, logger))
    .filter((trace) => trace && !trace.startsWith(LAZY_COMPILATION_IDENTIFIER)) as string[];

  if (!moduleNames.length) {
    return;
  }

  if (errorFile) {
    const formatted = removeLoaderChainDelimiter(errorFile, logger);
    if (moduleNames[0] !== formatted) {
      moduleNames.unshift(formatted);
    }
  }

  // Current moduleTrace is usually error -> entry, so reverse to entry -> error.
  let trace = moduleNames.slice().reverse();
  const MAX = 4;

  // Truncate long traces in non-verbose mode
  if (trace.length > MAX && !isVerbose(logger)) {
    const HEAD = 2;
    const TAIL = 2;
    trace = [
      ...trace.slice(0, HEAD),
      `... (${trace.length - HEAD - TAIL} hidden)`,
      ...trace.slice(trace.length - TAIL),
    ];
  }

  return color.dim(
    `Import traces (entry → ${level}):\n  ${trace.join('\n  ')} ${color.bold(color.red('×'))}`,
  );
}

function hintUnknownFiles(message: string): string {
  const hint = 'You may need an appropriate loader to handle this file type.';

  if (message.indexOf(hint) === -1) {
    return message;
  }

  const createPluginHint = (packageName: string, keyword: string) => {
    return `To enable support for ${keyword}, use "${color.yellow(
      `@rsbuild/plugin-${packageName}`,
    )}" ${color.dim(`(https://npmjs.com/package/@rsbuild/plugin-${packageName})`)}.\n`;
  };

  const recommendPlugins = [
    {
      test: /File: .+\.s(c|a)ss/,
      hint: createPluginHint('sass', 'Sass'),
    },
    {
      test: /File: .+\.less/,
      hint: createPluginHint('less', 'Less'),
    },
    {
      test: /File: .+\.styl(us)?/,
      hint: createPluginHint('stylus', 'Stylus'),
    },
    {
      test: /File: .+\.vue?/,
      hint: createPluginHint('vue', 'Vue'),
    },
    {
      test: /File: .+\.svelte?/,
      hint: createPluginHint('svelte', 'Svelte'),
    },
    {
      test: /File: .+\.mdx/,
      hint: createPluginHint('mdx', 'MDX'),
    },
    {
      test: /File: .+\.toml/,
      hint: createPluginHint('toml', 'TOML'),
    },
    {
      test: /File: .+\.yaml/,
      hint: createPluginHint('yaml', 'YAML'),
    },
  ];

  for (const plugin of recommendPlugins) {
    if (plugin.test.test(message)) {
      return message.replace(hint, plugin.hint);
    }
  }

  return message;
}

const hintAssetsConflict = (message: string): string => {
  const hint = 'Multiple assets emit different content to the same filename';

  if (message.indexOf(hint) === -1) {
    return message;
  }

  const extraMessage = `You may need to adjust ${color.yellow('output.filename')} configuration to prevent name conflicts. (See ${color.yellow('https://rsbuild.rs/config/output/filename')})`;

  return `${message}\n${extraMessage}`;
};

/**
 * Add node polyfill tip when failed to resolve node built-in modules.
 */
const hintNodePolyfill = (message: string): string => {
  const getTips = (moduleName: string) => {
    const tips = [
      `Error: "${moduleName}" is a built-in Node.js module and cannot be imported in client-side code.\n`,
      'Solution: Check if you need to import Node.js module.',
      '  - If not needed, remove the import.',
      `  - If needed, use "${color.yellow('@rsbuild/plugin-node-polyfill')}" to polyfill it. (See ${color.yellow('https://npmjs.com/package/@rsbuild/plugin-node-polyfill')})`,
    ];

    return `${message}\n\n${color.red(tips.join('\n'))}`;
  };

  const isNodeProtocolError = message.includes('need an additional plugin to handle "node:" URIs');
  if (isNodeProtocolError) {
    return getTips('node:*');
  }

  if (!message.includes(`Can't resolve`)) {
    return message;
  }

  const matchArray = stripAnsi(message).match(/Can't resolve '(\w+)'/);
  if (!matchArray) {
    return message;
  }

  const moduleName = matchArray[1];

  if (moduleName && builtinModules.includes(moduleName)) {
    return getTips(moduleName);
  }

  return message;
};

// Formats Rspack stats error to readable message
export function formatStatsError(
  stats: StatsError,
  root: string,
  level: 'error' | 'warning' = 'error',
  logger: Logger,
): string {
  const fileName = resolveFileName(stats, logger);
  let message = `${formatFileName(fileName, stats, root)}${stats.message}`;

  // display verbose messages in debug mode
  const verbose = isVerbose(logger);
  if (verbose) {
    if (stats.details) {
      message += `\nDetails: ${stats.details}\n`;
    }
    if (stats.stack) {
      message += `\n${stats.stack}`;
    }
  }

  // display module trace for errors
  if (level === 'error' || isVerbose(logger)) {
    const moduleTrace = formatModuleTrace(stats, fileName, level, logger);
    if (moduleTrace) {
      message += moduleTrace;
    }
  }

  // Remove inner error message
  const innerError = '-- inner error --';
  if (!verbose && message.includes(innerError)) {
    message = message.split(innerError)[0];
  }

  message = hintUnknownFiles(message);
  message = hintNodePolyfill(message);
  message = hintAssetsConflict(message);

  let lines = message.split('\n');

  // Remove duplicated newlines
  lines = lines.filter(
    (line, index, arr) =>
      index === 0 || line.trim() !== '' || line.trim() !== arr[index - 1].trim(),
  );

  // Reassemble the message
  message = lines.join('\n');

  return message.trim();
}
