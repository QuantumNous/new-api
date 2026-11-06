import type { Sandbox } from '@vercel/sandbox';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VercelSandboxSession } from './vercel-sandbox-session';

const decoder = new TextDecoder();

async function collect(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  let text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

type MockLogEntry = { stream: 'stdout' | 'stderr'; data: string };

function makeMockCommand(options: {
  logs?: MockLogEntry[];
  exitCode?: number;
}) {
  const entries = options.logs ?? [];
  const wait = vi.fn(async () => ({ exitCode: options.exitCode ?? 0 }));
  const kill = vi.fn(async () => {});
  const stdout = vi.fn(async () =>
    entries
      .filter(e => e.stream === 'stdout')
      .map(e => e.data)
      .join(''),
  );
  const stderr = vi.fn(async () =>
    entries
      .filter(e => e.stream === 'stderr')
      .map(e => e.data)
      .join(''),
  );
  const logs = vi.fn(async function* () {
    for (const entry of entries) yield entry;
  });
  return {
    handle: { wait, kill, stdout, stderr, logs, exitCode: options.exitCode },
    spies: { wait, kill, logs },
  };
}

function makeMockSandbox(overrides: Partial<Sandbox> = {}): {
  sandbox: Sandbox;
  spies: {
    runCommand: ReturnType<typeof vi.fn>;
    writeFiles: ReturnType<typeof vi.fn>;
    readFileToBuffer: ReturnType<typeof vi.fn>;
  };
} {
  const runCommand = vi.fn();
  const writeFiles = vi.fn(async () => {});
  const readFileToBuffer = vi.fn();
  const sandbox = {
    name: 'sbx_test',
    runCommand,
    writeFiles,
    readFileToBuffer,
    ...overrides,
  } as unknown as Sandbox;
  return { sandbox, spies: { runCommand, writeFiles, readFileToBuffer } };
}

describe('VercelSandboxSession', () => {
  describe('description', () => {
    it('mentions the sandbox name', () => {
      const { sandbox } = makeMockSandbox();
      expect(new VercelSandboxSession(sandbox).description).toContain(
        'sbx_test',
      );
    });
  });

  describe('run', () => {
    it('wraps the command in bash -c and maps stdout/stderr/exitCode', async () => {
      const { sandbox, spies } = makeMockSandbox();
      const { handle } = makeMockCommand({
        logs: [
          { stream: 'stdout', data: 'hi\n' },
          { stream: 'stderr', data: 'oops\n' },
        ],
        exitCode: 0,
      });
      spies.runCommand.mockResolvedValueOnce(handle);

      const vsbx = new VercelSandboxSession(sandbox);
      const result = await vsbx.run({ command: 'echo hi' });

      expect(spies.runCommand).toHaveBeenCalledWith(
        expect.objectContaining({ cmd: 'bash', args: ['-c', 'echo hi'] }),
      );
      expect(result).toEqual({ exitCode: 0, stdout: 'hi\n', stderr: 'oops\n' });
    });

    it('forwards workingDirectory as cwd', async () => {
      const { sandbox, spies } = makeMockSandbox();
      spies.runCommand.mockResolvedValueOnce(
        makeMockCommand({ logs: [], exitCode: 0 }).handle,
      );

      await new VercelSandboxSession(sandbox).run({
        command: 'ls',
        workingDirectory: '/work',
      });

      expect(spies.runCommand).toHaveBeenCalledWith(
        expect.objectContaining({ cwd: '/work' }),
      );
    });

    it('throws on pre-aborted signal', async () => {
      const { sandbox } = makeMockSandbox();
      const ac = new AbortController();
      ac.abort();
      await expect(
        new VercelSandboxSession(sandbox).run({
          command: 'echo',
          abortSignal: ac.signal,
        }),
      ).rejects.toThrow();
    });
  });

  describe('file I/O', () => {
    it('writeBinaryFile creates parent dirs and writes Uint8Array', async () => {
      const { sandbox, spies } = makeMockSandbox();
      spies.runCommand.mockResolvedValue(
        makeMockCommand({ logs: [], exitCode: 0 }).handle,
      );

      const bytes = new Uint8Array([0, 1, 2, 255]);
      await new VercelSandboxSession(sandbox).writeBinaryFile({
        path: '/work/sub/file.bin',
        content: bytes,
      });

      expect(spies.runCommand).toHaveBeenCalledWith(
        expect.objectContaining({ cmd: 'mkdir', args: ['-p', '/work/sub'] }),
      );
      expect(spies.writeFiles).toHaveBeenCalledWith(
        [{ path: '/work/sub/file.bin', content: bytes }],
        undefined,
      );
    });

    it('writeTextFile encodes utf-8 and delegates', async () => {
      const { sandbox, spies } = makeMockSandbox();
      spies.runCommand.mockResolvedValue(
        makeMockCommand({ logs: [], exitCode: 0 }).handle,
      );

      await new VercelSandboxSession(sandbox).writeTextFile({
        path: '/work/hello.txt',
        content: 'hi',
      });

      expect(spies.writeFiles).toHaveBeenCalled();
      const [files] = spies.writeFiles.mock.calls[0];
      expect(files[0].path).toBe('/work/hello.txt');
      expect(Buffer.from(files[0].content).toString('utf8')).toBe('hi');
    });

    it('readBinaryFile returns the buffer bytes', async () => {
      const { sandbox, spies } = makeMockSandbox();
      spies.readFileToBuffer.mockResolvedValueOnce(Buffer.from([1, 2, 3]));

      const out = await new VercelSandboxSession(sandbox).readBinaryFile({
        path: '/work/x',
      });
      expect(out).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('readBinaryFile returns null when SDK returns null', async () => {
      const { sandbox, spies } = makeMockSandbox();
      spies.readFileToBuffer.mockResolvedValueOnce(null);
      expect(
        await new VercelSandboxSession(sandbox).readBinaryFile({
          path: '/missing',
        }),
      ).toBeNull();
    });

    it('readBinaryFile maps ENOENT-shaped errors to null', async () => {
      const { sandbox, spies } = makeMockSandbox();
      spies.readFileToBuffer.mockRejectedValueOnce(
        Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' }),
      );
      expect(
        await new VercelSandboxSession(sandbox).readBinaryFile({
          path: '/missing',
        }),
      ).toBeNull();
    });

    it('readTextFile honours startLine/endLine', async () => {
      const { sandbox, spies } = makeMockSandbox();
      spies.readFileToBuffer.mockResolvedValueOnce(Buffer.from('a\nb\nc\nd\n'));

      const out = await new VercelSandboxSession(sandbox).readTextFile({
        path: '/x',
        startLine: 2,
        endLine: 3,
      });
      expect(out).toBe('b\nc');
    });

    it('readFile/writeFile round-trip through Web streams', async () => {
      const { sandbox, spies } = makeMockSandbox();
      spies.runCommand.mockResolvedValue(
        makeMockCommand({ logs: [], exitCode: 0 }).handle,
      );

      const payload = new TextEncoder().encode('streamed');
      await new VercelSandboxSession(sandbox).writeFile({
        path: '/work/streamed.txt',
        content: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(payload);
            controller.close();
          },
        }),
      });
      const [files] = spies.writeFiles.mock.calls[0];
      expect(files[0].content).toEqual(payload);

      spies.readFileToBuffer.mockResolvedValueOnce(Buffer.from(payload));
      const stream = await new VercelSandboxSession(sandbox).readFile({
        path: '/work/streamed.txt',
      });
      expect(stream).not.toBeNull();
      expect(await collect(stream!)).toBe('streamed');
    });
  });

  describe('spawn', () => {
    let baseSandbox: ReturnType<typeof makeMockSandbox>;

    beforeEach(() => {
      baseSandbox = makeMockSandbox();
    });

    it('streams stdout and stderr from logs() and resolves wait()', async () => {
      const { handle } = makeMockCommand({
        logs: [
          { stream: 'stdout', data: 'out\n' },
          { stream: 'stderr', data: 'err\n' },
        ],
        exitCode: 0,
      });
      baseSandbox.spies.runCommand.mockResolvedValueOnce(handle);

      const proc = await new VercelSandboxSession(baseSandbox.sandbox).spawn({
        command: 'node x.js',
      });

      expect(baseSandbox.spies.runCommand).toHaveBeenCalledWith(
        expect.objectContaining({ detached: true }),
      );

      const [stdout, stderr, { exitCode }] = await Promise.all([
        collect(proc.stdout),
        collect(proc.stderr),
        proc.wait(),
      ]);

      expect(stdout).toBe('out\n');
      expect(stderr).toBe('err\n');
      expect(exitCode).toBe(0);
    });

    it('surfaces non-zero exit codes via wait()', async () => {
      const { handle } = makeMockCommand({ exitCode: 7 });
      baseSandbox.spies.runCommand.mockResolvedValueOnce(handle);
      const proc = await new VercelSandboxSession(baseSandbox.sandbox).spawn({
        command: 'exit 7',
      });
      expect((await proc.wait()).exitCode).toBe(7);
    });

    it('kill() delegates to the underlying command', async () => {
      const { handle, spies } = makeMockCommand({});
      baseSandbox.spies.runCommand.mockResolvedValueOnce(handle);
      const proc = await new VercelSandboxSession(baseSandbox.sandbox).spawn({
        command: 'sleep 10',
      });
      await proc.kill();
      expect(spies.kill).toHaveBeenCalledOnce();
    });

    it('pre-aborted signal causes wait() to reject', async () => {
      const { handle } = makeMockCommand({});
      baseSandbox.spies.runCommand.mockResolvedValueOnce(handle);
      const ac = new AbortController();

      const proc = await new VercelSandboxSession(baseSandbox.sandbox).spawn({
        command: 'sleep 10',
        abortSignal: ac.signal,
      });
      ac.abort(new Error('user cancelled'));
      await expect(proc.wait()).rejects.toThrow('user cancelled');
    });
  });
});
