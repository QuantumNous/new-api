import fs from 'node:fs';
import { join } from 'node:path';
import { expand } from 'dotenv-expand';
import { color, getNodeEnv } from './helpers';
import { isFileSync } from './helpers/fs';
import { defaultLogger } from './logger';

const DOTENV_LINE =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;

/**
 * This method is modified based on source found in
 * https://github.com/motdotla/dotenv/blob/v16.5.0/lib/main.js#L9-L48
 *
 * Copyright (c) 2015, Scott Motte
 *
 * We copied this method because Rsbuild only uses the `parse` method
 * in dotenv and most of the other code is redundant.
 */
function parse(src: Buffer) {
  const obj: Record<string, string> = {};

  // Convert buffer to string
  let lines = src.toString();

  // Convert line breaks to same format
  lines = lines.replace(/\r\n?/gm, '\n');

  let match: RegExpExecArray | null;
  while ((match = DOTENV_LINE.exec(lines)) != null) {
    const key = match[1];

    // Default undefined or null to empty string
    let value = match[2] || '';

    // Remove whitespace
    value = value.trim();

    // Check if double quoted
    const maybeQuote = value[0];

    // Remove surrounding quotes
    value = value.replace(/^(['"`])([\s\S]*)\1$/gm, '$2');

    // Expand newlines if double quoted
    if (maybeQuote === '"') {
      value = value.replace(/\\n/g, '\n');
      value = value.replace(/\\r/g, '\r');
    }

    // Add to object
    obj[key] = value;
  }

  return obj;
}

export type LoadEnvOptions = {
  /**
   * The root path to load the env file
   * @default process.cwd()
   */
  cwd?: string;
  /**
   * Used to specify the name of the .env.[mode] file
   * @default process.env.NODE_ENV
   */
  mode?: string;
  /**
   * The prefix of public variables
   * @default ['PUBLIC_']
   */
  prefixes?: string[];
  /**
   * Specify a target object to store environment variables.
   * If not provided, variables will be written to `process.env`.
   * @default process.env
   */
  processEnv?: Record<string, string>;
};

export type LoadEnvResult = {
  /**
   * All environment variables in the .env file
   */
  parsed: Record<string, string>;
  /**
   * The absolute paths to all env files
   */
  filePaths: string[];
  /**
   * Environment variables that start with prefixes.
   *
   * @example
   * ```ts
   * {
   *   PUBLIC_FOO: 'bar',
   * }
   * ```
   **/
  rawPublicVars: Record<string, string | undefined>;
  /**
   * Formatted environment variables that start with prefixes.
   * The keys contain the prefixes `process.env.*` and `import.meta.env.*`.
   * The values are processed by `JSON.stringify`.
   *
   * @example
   * ```ts
   * {
   *   'process.env.PUBLIC_FOO': '"bar"',
   *   'import.meta.env.PUBLIC_FOO': '"bar"',
   * }
   * ```
   **/
  publicVars: Record<string, string>;
  /**
   * Clear the environment variables mounted on `process.env`
   */
  cleanup: () => void;
};

export function loadEnv({
  cwd = process.cwd(),
  mode = getNodeEnv(),
  prefixes = ['PUBLIC_'],
  processEnv = process.env as Record<string, string>,
}: LoadEnvOptions = {}): LoadEnvResult {
  if (mode === 'local') {
    throw new Error(
      `${color.dim('[rsbuild:loadEnv]')} ${color.yellow('local')} cannot be used as a value for env mode, because ${color.yellow(
        '.env.local',
      )} represents a temporary local file. Please use another value.`,
    );
  }

  const filenames = ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`];

  const filePaths = filenames.map((filename) => join(cwd, filename)).filter(isFileSync);

  const parsed: Record<string, string> = {};

  for (const envPath of filePaths) {
    Object.assign(parsed, parse(fs.readFileSync(envPath)));
    defaultLogger.debug('loaded env file:', envPath);
  }

  // dotenv-expand does not override existing env vars by default,
  // but we should allow overriding NODE_ENV, which is very common.
  // https://github.com/web-infra-dev/rsbuild/issues/2904
  if (parsed.NODE_ENV) {
    processEnv.NODE_ENV = parsed.NODE_ENV;
  }

  expand({ parsed, processEnv });

  const publicVars: Record<string, string> = {};
  const rawPublicVars: Record<string, string | undefined> = {};

  for (const key of Object.keys(processEnv)) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      const val = processEnv[key];
      publicVars[`import.meta.env.${key}`] = JSON.stringify(val);
      publicVars[`process.env.${key}`] = JSON.stringify(val);
      rawPublicVars[key] = val;
    }
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) {
      return;
    }

    for (const key of Object.keys(parsed)) {
      // do not cleanup NODE_ENV,
      // otherwise the .env.${mode} file will not be loaded
      if (key === 'NODE_ENV') {
        continue;
      }

      if (processEnv[key] === parsed[key]) {
        delete processEnv[key];
      }
    }

    cleaned = true;
  };

  return {
    parsed,
    cleanup,
    filePaths,
    publicVars,
    rawPublicVars,
  };
}
