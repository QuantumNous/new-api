import path from 'node:path';
import { shellQuote } from '@ai-sdk/harness/utils';
import type { Experimental_SandboxSession } from '@ai-sdk/provider-utils';
import type { PiPathMapper } from './pi-paths';

export type PiRemoteFileChangeKind = 'create' | 'modify';

export interface PiRemoteOpsOptions {
  readonly sandbox: Experimental_SandboxSession;
  readonly paths: PiPathMapper;
  readonly env?: Record<string, string>;
  readonly onFileChange?: (
    event: PiRemoteFileChangeKind,
    relativePath: string,
    content: Buffer,
  ) => void;
}

export interface PiRemoteOps {
  readonly paths: PiPathMapper;
  readBuffer(inputPath: string): Promise<Buffer>;
  writeFile(inputPath: string, content: string): Promise<void>;
  editFile(
    inputPath: string,
    oldText: string,
    newText: string,
  ): Promise<string>;
  listDirectory(inputPath?: string, limit?: number): Promise<string[]>;
  findFiles(
    pattern: string,
    inputPath?: string,
    limit?: number,
  ): Promise<string[]>;
  grepFiles(
    pattern: string,
    input: {
      path?: string;
      glob?: string;
      ignoreCase?: boolean;
      literal?: boolean;
      context?: number;
      limit?: number;
    },
  ): Promise<string>;
  access(inputPath: string): Promise<void>;
  exec(
    command: string,
    cwd: string,
    input: {
      onData: (data: Buffer) => void;
      signal?: AbortSignal;
      timeout?: number;
    },
  ): Promise<{ exitCode: number | null }>;
}

interface RunShellInput {
  cwd?: string;
  signal?: AbortSignal;
  onData?: (data: Buffer) => void;
}

interface RunShellResult {
  exitCode: number | null;
  output: Buffer;
}

function lastOutputLine(output: Buffer): string | undefined {
  return output.toString('utf8').trim().split('\n').filter(Boolean).at(-1);
}

export function createPiRemoteOps(options: PiRemoteOpsOptions): PiRemoteOps {
  const runShell = async (
    command: string,
    input: RunShellInput = {},
  ): Promise<RunShellResult> => {
    // `sandbox.run({ command })` already wraps in `bash -c`; we pass the
    // shell snippet directly. shellQuote is still used inside `command`
    // for path/value interpolation by the callers.
    const result = await options.sandbox.run({
      command,
      ...(input.cwd
        ? { workingDirectory: options.paths.toSandboxPath(input.cwd) }
        : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(input.signal ? { abortSignal: input.signal } : {}),
    });

    const combined = `${result.stdout}${result.stderr}`;
    const output = Buffer.from(combined, 'utf8');
    if (output.length > 0) {
      input.onData?.(output);
    }

    return {
      exitCode: result.exitCode,
      output,
    };
  };

  const resolveExistingSandboxPath = async (
    remotePath: string,
    inputPath: string,
  ): Promise<string> => {
    const result = await runShell(
      [
        `target=${shellQuote(remotePath)}`,
        `if [ ! -e "$target" ]; then echo "__PI_REALPATH_NOT_FOUND__"; exit 2; fi`,
        `resolved=$(realpath "$target" 2>/dev/null) || { echo "__PI_REALPATH_FAILED__"; exit 3; }`,
        `printf '%s\\n' "$resolved"`,
      ].join('; '),
    );

    const output = result.output.toString('utf8');
    if (output.includes('__PI_REALPATH_NOT_FOUND__')) {
      throw new Error(`Path not found: ${inputPath}`);
    }
    if (output.includes('__PI_REALPATH_FAILED__') || result.exitCode !== 0) {
      throw new Error(`Unable to resolve path: ${inputPath}`);
    }

    const resolvedPath = lastOutputLine(result.output);
    if (!resolvedPath) {
      throw new Error(`Unable to resolve path: ${inputPath}`);
    }
    return resolvedPath;
  };

  const resolveReadableSandboxPath = async (
    remotePath: string,
    inputPath: string,
  ): Promise<string> =>
    options.paths.assertReadableSandboxPath(
      await resolveExistingSandboxPath(remotePath, inputPath),
    );

  const resolveWritableSandboxPath = async (
    remotePath: string,
    inputPath: string,
  ): Promise<string> => {
    const result = await runShell(
      [
        `target=${shellQuote(remotePath)}`,
        `if [ -e "$target" ] || [ -L "$target" ]; then resolved=$(realpath "$target" 2>/dev/null) || { echo "__PI_REALPATH_FAILED__"; exit 3; }; printf '%s\\n' "$resolved"; exit 0; fi`,
        `dir=$(dirname "$target")`,
        `base=$(basename "$target")`,
        `missing="$base"`,
        `while [ ! -e "$dir" ] && [ ! -L "$dir" ]; do parent=$(dirname "$dir"); if [ "$parent" = "$dir" ]; then echo "__PI_REALPATH_NOT_FOUND__"; exit 2; fi; missing="$(basename "$dir")/$missing"; dir="$parent"; done`,
        `resolved_dir=$(realpath "$dir" 2>/dev/null) || { echo "__PI_REALPATH_FAILED__"; exit 3; }`,
        `printf '%s/%s\\n' "$resolved_dir" "$missing"`,
      ].join('; '),
    );

    const output = result.output.toString('utf8');
    if (
      output.includes('__PI_REALPATH_NOT_FOUND__') ||
      output.includes('__PI_REALPATH_FAILED__') ||
      result.exitCode !== 0
    ) {
      throw new Error(`Unable to resolve path: ${inputPath}`);
    }

    const resolvedPath = lastOutputLine(result.output);
    if (!resolvedPath) {
      throw new Error(`Unable to resolve path: ${inputPath}`);
    }
    return options.paths.assertSandboxPath(resolvedPath);
  };

  const readBuffer = async (inputPath: string): Promise<Buffer> => {
    const remotePath = options.paths.toReadableSandboxPath(inputPath);
    const resolvedPath = await resolveReadableSandboxPath(
      remotePath,
      inputPath,
    );
    const bytes = await options.sandbox.readBinaryFile({
      path: resolvedPath,
    });
    if (!bytes) {
      throw new Error(`Path not found: ${inputPath}`);
    }
    return Buffer.from(bytes);
  };

  const writeFile = async (
    inputPath: string,
    content: string,
  ): Promise<void> => {
    const remotePath = options.paths.toSandboxPath(inputPath);
    const resolvedPath = await resolveWritableSandboxPath(
      remotePath,
      inputPath,
    );
    const previous = await options.sandbox.readBinaryFile({
      path: resolvedPath,
    });
    await runShell(`mkdir -p ${shellQuote(path.posix.dirname(resolvedPath))}`);
    await options.sandbox.writeTextFile({ path: resolvedPath, content });
    options.onFileChange?.(
      previous ? 'modify' : 'create',
      options.paths.toRelativePath(resolvedPath),
      Buffer.from(content, 'utf8'),
    );
  };

  const editFile = async (
    inputPath: string,
    oldText: string,
    newText: string,
  ): Promise<string> => {
    const current = (await readBuffer(inputPath)).toString('utf8');
    const index = current.indexOf(oldText);
    if (index === -1) {
      throw new Error(`Text to replace was not found in ${inputPath}`);
    }
    const updated = `${current.slice(0, index)}${newText}${current.slice(
      index + oldText.length,
    )}`;
    await writeFile(inputPath, updated);
    return updated;
  };

  const listDirectory = async (
    inputPath: string = '.',
    limit: number = 500,
  ): Promise<string[]> => {
    const remotePath = options.paths.toReadableSandboxPath(inputPath);
    const resolvedPath = await resolveReadableSandboxPath(
      remotePath,
      inputPath,
    );
    const result = await runShell(
      [
        `if [ ! -e ${shellQuote(resolvedPath)} ]; then echo "__PI_LS_NOT_FOUND__"; exit 2; fi`,
        `if [ ! -d ${shellQuote(resolvedPath)} ]; then echo "__PI_LS_NOT_DIR__"; exit 3; fi`,
        `cd ${shellQuote(resolvedPath)}`,
        'ls -1Ap',
      ].join('; '),
    );

    const output = result.output.toString('utf8').trim();
    if (output.includes('__PI_LS_NOT_FOUND__')) {
      throw new Error(`Path not found: ${inputPath}`);
    }
    if (output.includes('__PI_LS_NOT_DIR__')) {
      throw new Error(`Not a directory: ${inputPath}`);
    }

    return output
      .split('\n')
      .filter(Boolean)
      .map(line => line.replace(/[*=@|]$/, ''))
      .sort((left, right) =>
        left.toLowerCase().localeCompare(right.toLowerCase()),
      )
      .slice(0, limit);
  };

  const findFiles = async (
    pattern: string,
    inputPath: string = '.',
    limit: number = 1_000,
  ): Promise<string[]> => {
    const remotePath = options.paths.toReadableSandboxPath(inputPath);
    const resolvedPath = await resolveReadableSandboxPath(
      remotePath,
      inputPath,
    );
    const result = await runShell(
      [
        `if [ ! -e ${shellQuote(resolvedPath)} ]; then echo "__PI_FIND_NOT_FOUND__"; exit 2; fi`,
        `if [ -d ${shellQuote(resolvedPath)} ]; then find ${shellQuote(resolvedPath)} -type f -print; else printf '%s\\n' ${shellQuote(resolvedPath)}; fi`,
      ].join('; '),
    );

    const output = result.output.toString('utf8').trim();
    if (output.includes('__PI_FIND_NOT_FOUND__')) {
      throw new Error(`Path not found: ${inputPath}`);
    }

    const searchRoot = resolvedPath;
    return output
      .split('\n')
      .filter(Boolean)
      .map(absolutePath => {
        if (absolutePath === searchRoot) {
          return path.posix.basename(absolutePath);
        }
        return path.posix.relative(searchRoot, absolutePath);
      })
      .filter(
        candidate =>
          candidate.length > 0 && path.matchesGlob(candidate, pattern),
      )
      .sort((left, right) =>
        left.toLowerCase().localeCompare(right.toLowerCase()),
      )
      .slice(0, limit);
  };

  const grepFiles = async (
    pattern: string,
    input: {
      path?: string;
      glob?: string;
      ignoreCase?: boolean;
      literal?: boolean;
      context?: number;
      limit?: number;
    },
  ): Promise<string> => {
    const remotePath = options.paths.toReadableSandboxPath(input.path ?? '.');
    const resolvedPath = await resolveReadableSandboxPath(
      remotePath,
      input.path ?? '.',
    );
    const relativeTarget = options.paths.toRelativePath(resolvedPath);
    const targetPath =
      relativeTarget.startsWith('../') || path.posix.isAbsolute(relativeTarget)
        ? resolvedPath
        : relativeTarget;
    const flags = [
      '-R',
      '-n',
      '--binary-files=without-match',
      ...(input.ignoreCase ? ['-i'] : []),
      ...(input.literal ? ['-F'] : []),
      ...(typeof input.context === 'number' && input.context > 0
        ? ['-C', String(input.context)]
        : []),
      ...(input.glob ? ['--include', input.glob] : []),
    ];
    const limit = Math.max(1, input.limit ?? 100);
    const result = await runShell(
      [
        `if [ ! -e ${shellQuote(resolvedPath)} ]; then echo "__PI_GREP_NOT_FOUND__"; exit 2; fi`,
        `cd ${shellQuote(options.paths.sandboxWorkDir)}`,
        `grep ${flags.map(shellQuote).join(' ')} -- ${shellQuote(pattern)} ${shellQuote(targetPath)} 2>/dev/null | head -n ${limit}`,
      ].join('; '),
    );

    const output = result.output.toString('utf8').trim();
    if (output.includes('__PI_GREP_NOT_FOUND__')) {
      throw new Error(`Path not found: ${input.path ?? '.'}`);
    }

    return output || 'No matches found';
  };

  return {
    paths: options.paths,
    readBuffer,
    writeFile,
    editFile,
    listDirectory,
    findFiles,
    grepFiles,
    async access(inputPath: string) {
      await readBuffer(inputPath);
    },
    async exec(command, cwd, input): Promise<{ exitCode: number | null }> {
      const controller = new AbortController();
      // `input.timeout` is expressed in seconds (Pi's `bash` tool contract),
      // so convert to milliseconds for `setTimeout`.
      const timeoutId =
        typeof input.timeout === 'number' && input.timeout > 0
          ? setTimeout(() => controller.abort(), input.timeout * 1000)
          : undefined;

      const forwardedSignal = input.signal;
      const onAbort = () => controller.abort();
      forwardedSignal?.addEventListener('abort', onAbort, { once: true });

      try {
        const result = await runShell(command, {
          cwd,
          signal: controller.signal,
          onData: input.onData,
        });
        return { exitCode: result.exitCode };
      } finally {
        forwardedSignal?.removeEventListener('abort', onAbort);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    },
  };
}
