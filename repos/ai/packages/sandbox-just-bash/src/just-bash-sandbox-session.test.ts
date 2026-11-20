import { Sandbox } from 'just-bash';
import { beforeEach, describe, expect, it } from 'vitest';
import { JustBashSandboxSession } from './just-bash-sandbox-session';

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

describe('JustBashSandboxSession', () => {
  let sandbox: JustBashSandboxSession;

  beforeEach(async () => {
    sandbox = new JustBashSandboxSession(
      await Sandbox.create({ cwd: '/work' }),
    );
  });

  describe('description', () => {
    it('mentions the current working directory', () => {
      expect(sandbox.description).toContain('Current working directory: /work');
    });
  });

  describe('run', () => {
    it('returns stdout, stderr, and exitCode', async () => {
      const result = await sandbox.run({
        command: 'echo hello && echo bye >&2',
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello\n');
      expect(result.stderr).toBe('bye\n');
    });

    it('honours workingDirectory', async () => {
      await sandbox.run({ command: 'mkdir -p /tmp/cwd-test' });

      const result = await sandbox.run({
        command: 'pwd',
        workingDirectory: '/tmp/cwd-test',
      });

      expect(result.stdout.trim()).toBe('/tmp/cwd-test');
    });

    it('throws when abortSignal is already aborted', async () => {
      const ac = new AbortController();
      ac.abort();
      await expect(
        sandbox.run({ command: 'echo hi', abortSignal: ac.signal }),
      ).rejects.toThrow();
    });
  });

  describe('file I/O', () => {
    it('writes and reads text files', async () => {
      await sandbox.writeTextFile({
        path: '/work/notes.txt',
        content: 'line 1\nline 2\nline 3\n',
      });

      const full = await sandbox.readTextFile({ path: '/work/notes.txt' });
      expect(full).toBe('line 1\nline 2\nline 3\n');

      const slice = await sandbox.readTextFile({
        path: '/work/notes.txt',
        startLine: 2,
        endLine: 3,
      });
      expect(slice).toBe('line 2\nline 3');
    });

    it('resolves relative paths against the sandbox cwd', async () => {
      await sandbox.writeTextFile({
        path: 'relative.txt',
        content: 'hi',
      });

      const absolute = await sandbox.readTextFile({
        path: '/work/relative.txt',
      });
      expect(absolute).toBe('hi');
    });

    it('returns null when reading a missing file', async () => {
      expect(
        await sandbox.readTextFile({ path: '/work/does-not-exist.txt' }),
      ).toBeNull();
      expect(
        await sandbox.readBinaryFile({ path: '/work/does-not-exist.txt' }),
      ).toBeNull();
      expect(
        await sandbox.readFile({ path: '/work/does-not-exist.txt' }),
      ).toBeNull();
    });

    it('round-trips binary payloads', async () => {
      const payload = new Uint8Array([0, 1, 2, 255, 254, 0, 128]);
      await sandbox.writeBinaryFile({
        path: '/work/bytes.bin',
        content: payload,
      });

      const out = await sandbox.readBinaryFile({ path: '/work/bytes.bin' });
      expect(out).toEqual(payload);
    });

    it('writeFile and readFile stream through the VFS', async () => {
      const bytes = new TextEncoder().encode('streamed');
      await sandbox.writeFile({
        path: '/work/streamed.txt',
        content: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
      });

      const stream = await sandbox.readFile({ path: '/work/streamed.txt' });
      expect(stream).not.toBeNull();
      expect(await collect(stream!)).toBe('streamed');
    });
  });

  describe('spawn', () => {
    it('streams stdout and stderr and resolves wait() with exit code', async () => {
      const proc = await sandbox.spawn({
        command: 'echo out && echo err >&2',
      });

      const [stdout, stderr, { exitCode }] = await Promise.all([
        collect(proc.stdout),
        collect(proc.stderr),
        proc.wait(),
      ]);

      expect(stdout).toBe('out\n');
      expect(stderr).toBe('err\n');
      expect(exitCode).toBe(0);
    });

    it('shares the VFS with file operations', async () => {
      await sandbox.writeTextFile({
        path: '/work/shared.txt',
        content: 'shared payload',
      });

      const proc = await sandbox.spawn({
        command: 'cat /work/shared.txt',
      });

      const stdout = await collect(proc.stdout);
      await proc.wait();
      expect(stdout).toBe('shared payload');
    });

    it('non-zero exit codes are surfaced via wait()', async () => {
      const proc = await sandbox.spawn({ command: 'exit 7' });
      await collect(proc.stdout);
      await collect(proc.stderr);
      const result = await proc.wait();
      expect(result.exitCode).toBe(7);
    });

    it('kill() terminates the process', async () => {
      const proc = await sandbox.spawn({
        command: 'sleep 10',
      });
      await proc.kill();
      const result = await proc.wait();
      expect(result.exitCode).not.toBe(0);
    });

    it('abortSignal aborts a running process', async () => {
      const ac = new AbortController();
      const proc = await sandbox.spawn({
        command: 'sleep 10',
        abortSignal: ac.signal,
      });
      ac.abort();
      await expect(proc.wait()).rejects.toThrow();
    });
  });
});
