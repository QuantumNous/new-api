import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { isAbsolute, join, dirname } from 'node:path';
import { Readable, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  extractLines,
  type Experimental_SandboxProcess,
} from '@ai-sdk/provider-utils';
import { type Experimental_SandboxSession as SandboxSession } from 'ai';
import {
  bytesToStream,
  collectStream,
  collectStreamToString,
} from './lib/stream-utils';

/**
 * WARNING: This is not a security sandbox.
 *
 * LocalSandboxSession only sets the working directory for shell commands. Commands can
 * still read or edit files outside `rootDirectory` through absolute paths,
 * parent-directory paths, symlinks, subprocesses, and shell features. Only use
 * this with trusted commands.
 */
export class LocalSandboxSession implements SandboxSession {
  /**
   * Root directory used as the default working directory and the anchor for
   * relative paths in file methods.
   *
   * WARNING: This does not provide filesystem isolation.
   */
  readonly rootDirectory: string;

  constructor({ rootDirectory }: { rootDirectory: string }) {
    this.rootDirectory = rootDirectory;
  }

  private resolvePath(path: string): string {
    return isAbsolute(path) ? path : join(this.rootDirectory, path);
  }

  async run({
    command,
    workingDirectory,
    env,
    abortSignal,
  }: {
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
    abortSignal?: AbortSignal;
  }) {
    const proc = await this.spawn({
      command,
      workingDirectory,
      env,
      abortSignal,
    });

    const [stdout, stderr, { exitCode }] = await Promise.all([
      collectStreamToString(proc.stdout),
      collectStreamToString(proc.stderr),
      proc.wait(),
    ]);

    return { exitCode, stdout, stderr };
  }

  async spawn({
    command,
    workingDirectory,
    env,
    abortSignal,
  }: {
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
    abortSignal?: AbortSignal;
  }): Promise<Experimental_SandboxProcess> {
    abortSignal?.throwIfAborted();

    if (env != null && Object.keys(env).length > 0) {
      throw new Error('LocalSandboxSession does not support the `env` option.');
    }

    const child = spawn('bash', ['-c', command], {
      cwd: workingDirectory ?? this.rootDirectory,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout = Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>;
    const stderr = Readable.toWeb(child.stderr) as ReadableStream<Uint8Array>;

    const exitPromise = new Promise<{ exitCode: number }>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (code != null) {
          resolve({ exitCode: code });
        } else if (signal != null) {
          resolve({
            exitCode: 128 + (typeof signal === 'number' ? signal : 1),
          });
        } else {
          resolve({ exitCode: 1 });
        }
      });
    });

    const abortHandler = () => {
      child.kill('SIGTERM');
    };
    if (abortSignal?.aborted) {
      abortHandler();
    } else {
      abortSignal?.addEventListener('abort', abortHandler, { once: true });
    }

    return {
      pid: child.pid,
      stdout,
      stderr,
      async wait(): Promise<{ exitCode: number }> {
        try {
          const result = await exitPromise;
          if (abortSignal?.aborted) {
            throw (
              abortSignal.reason ?? new DOMException('Aborted', 'AbortError')
            );
          }
          return result;
        } finally {
          abortSignal?.removeEventListener('abort', abortHandler);
        }
      },
      async kill(): Promise<void> {
        child.kill('SIGTERM');
      },
    };
  }

  async readFile({
    path,
    abortSignal,
  }: {
    path: string;
    abortSignal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array> | null> {
    const resolved = this.resolvePath(path);
    try {
      await stat(resolved);
    } catch (error: any) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
    const nodeStream = createReadStream(resolved, { signal: abortSignal });
    return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  }

  async writeFile({
    path,
    content,
    abortSignal,
  }: {
    path: string;
    content: ReadableStream<Uint8Array>;
    abortSignal?: AbortSignal;
  }): Promise<void> {
    const resolved = this.resolvePath(path);
    await mkdir(dirname(resolved), { recursive: true });
    const source = Readable.fromWeb(content as any);
    const sink = createWriteStream(resolved);
    await pipeline(source, sink as unknown as Writable, {
      signal: abortSignal,
    });
  }

  async readBinaryFile({
    path,
    abortSignal,
  }: {
    path: string;
    abortSignal?: AbortSignal;
  }): Promise<Uint8Array | null> {
    const stream = await this.readFile({ path, abortSignal });
    if (stream == null) return null;
    return collectStream(stream);
  }

  async writeBinaryFile({
    path,
    content,
    abortSignal,
  }: {
    path: string;
    content: Uint8Array;
    abortSignal?: AbortSignal;
  }): Promise<void> {
    await this.writeFile({
      path,
      content: bytesToStream(content),
      abortSignal,
    });
  }

  async readTextFile({
    path,
    encoding = 'utf-8',
    startLine,
    endLine,
    abortSignal,
  }: {
    path: string;
    encoding?: string;
    startLine?: number;
    endLine?: number;
    abortSignal?: AbortSignal;
  }): Promise<string | null> {
    const bytes = await this.readBinaryFile({ path, abortSignal });
    if (bytes == null) return null;
    const text = Buffer.from(bytes).toString(encoding as BufferEncoding);
    return extractLines({ text, startLine, endLine });
  }

  async writeTextFile({
    path,
    content,
    encoding = 'utf-8',
    abortSignal,
  }: {
    path: string;
    content: string;
    encoding?: string;
    abortSignal?: AbortSignal;
  }): Promise<void> {
    const bytes = Buffer.from(content, encoding as BufferEncoding);
    await this.writeBinaryFile({
      path,
      content: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      abortSignal,
    });
  }

  get description() {
    return [
      'WARNING: LocalSandboxSession is not a true sandbox.',
      'Commands can access files outside the root directory.',
      `Root directory: ${this.rootDirectory}`,
    ].join('\n');
  }
}
