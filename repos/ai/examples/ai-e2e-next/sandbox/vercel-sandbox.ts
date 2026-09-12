import { isAbsolute, join } from 'node:path';
import { Readable } from 'node:stream';
import {
  extractLines,
  type Experimental_SandboxProcess,
} from '@ai-sdk/provider-utils';
import { type Experimental_SandboxSession as SandboxSession } from 'ai';
import type { Command, Sandbox as VercelSandboxSDK } from '@vercel/sandbox';
import {
  bytesToStream,
  collectStream,
  collectStreamToString,
} from './stream-utils';

const rootDirectory = '/vercel/sandbox';

// Vercel Sandbox authenticates with a Vercel OIDC token.
//
// Deployed on Vercel:
// 1. Open the project in the Vercel dashboard.
// 2. Go to Settings > Security.
// 3. Enable "Secure backend access with OIDC federation" and save.
//
// Local development:
// 1. Run `vercel link`.
// 2. Run `vercel env pull` to write VERCEL_OIDC_TOKEN to .env.local.
//
// Without OIDC, @vercel/sandbox reports a missing `x-vercel-oidc-token`
// header when creating or retrieving sandboxes.
export class VercelSandboxSession implements SandboxSession {
  constructor(public readonly sandbox: VercelSandboxSDK) {}

  private resolvePath(path: string): string {
    return isAbsolute(path) ? path : join(rootDirectory, path);
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

    const live = await this.sandbox.runCommand({
      cmd: 'bash',
      args: ['-c', command],
      cwd: workingDirectory ?? rootDirectory,
      env,
      detached: true,
    });

    return createSandboxProcess(live, abortSignal);
  }

  async readFile({
    path,
    abortSignal,
  }: {
    path: string;
    abortSignal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array> | null> {
    abortSignal?.throwIfAborted();
    const result = await this.sandbox.readFile({
      path: this.resolvePath(path),
    });
    if (result == null) return null;
    return Readable.toWeb(
      Readable.from(result as NodeJS.ReadableStream),
    ) as ReadableStream<Uint8Array>;
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
    abortSignal?.throwIfAborted();
    const bytes = await collectStream(content);
    abortSignal?.throwIfAborted();
    await this.sandbox.writeFiles([
      { path: this.resolvePath(path), content: Buffer.from(bytes) },
    ]);
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

  async stop() {
    await this.sandbox.stop();
  }

  get description() {
    return `Vercel Sandbox: ${this.sandbox.name}\nRoot directory: ${rootDirectory}`;
  }
}

function createSandboxProcess(
  command: Command,
  abortSignal: AbortSignal | undefined,
): Experimental_SandboxProcess {
  const encoder = new TextEncoder();
  const controllers: {
    stdout?: ReadableStreamDefaultController<Uint8Array>;
    stderr?: ReadableStreamDefaultController<Uint8Array>;
  } = {};

  const stdout = new ReadableStream<Uint8Array>({
    start(controller) {
      controllers.stdout = controller;
    },
  });

  const stderr = new ReadableStream<Uint8Array>({
    start(controller) {
      controllers.stderr = controller;
    },
  });

  const drained = (async () => {
    try {
      const iterator = abortSignal
        ? command.logs({ signal: abortSignal })
        : command.logs();
      for await (const message of iterator) {
        const target =
          message.stream === 'stdout' ? controllers.stdout : controllers.stderr;
        target?.enqueue(encoder.encode(message.data));
      }
      controllers.stdout?.close();
      controllers.stderr?.close();
    } catch (error) {
      controllers.stdout?.error(error);
      controllers.stderr?.error(error);
    }
  })();

  const abortCommand = () => void command.kill('SIGTERM');
  if (abortSignal?.aborted) {
    abortCommand();
  } else {
    abortSignal?.addEventListener('abort', abortCommand, { once: true });
  }

  return {
    stdout,
    stderr,
    async wait(): Promise<{ exitCode: number }> {
      try {
        const finished = await command.wait();
        await drained;
        if (abortSignal?.aborted) {
          throw abortSignal.reason ?? new DOMException('Aborted', 'AbortError');
        }
        return { exitCode: finished.exitCode };
      } finally {
        abortSignal?.removeEventListener('abort', abortCommand);
      }
    },
    async kill(): Promise<void> {
      await command.kill('SIGTERM');
    },
  };
}
