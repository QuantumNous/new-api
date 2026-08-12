import type { Experimental_SandboxSession } from '@ai-sdk/provider-utils';
import { describe, expect, it, vi } from 'vitest';
import { createPiPathMapper } from './pi-paths';
import { createPiRemoteOps } from './pi-remote-ops';

type RunCalls = Array<{
  command: string;
  workingDirectory?: string;
}>;
type ReadCalls = string[];
type WriteCalls = Array<{ path: string; content: string }>;

function makeMockSandbox(behaviors: {
  run?: (command: string) => {
    stdout?: string;
    stderr?: string;
    exitCode?: number;
  };
  readBinary?: (path: string) => Uint8Array | null;
}): {
  sandbox: Experimental_SandboxSession;
  runCalls: RunCalls;
  readCalls: ReadCalls;
  writeCalls: WriteCalls;
} {
  const runCalls: RunCalls = [];
  const readCalls: ReadCalls = [];
  const writeCalls: WriteCalls = [];

  const sandbox: Experimental_SandboxSession = {
    description: 'mock',
    run: vi.fn(
      async ({
        command,
        workingDirectory,
      }: {
        command: string;
        workingDirectory?: string;
      }) => {
        runCalls.push({ command, workingDirectory });
        const result = behaviors.run?.(command) ?? {};
        return {
          exitCode: result.exitCode ?? 0,
          stdout: result.stdout ?? '',
          stderr: result.stderr ?? '',
        };
      },
    ),
    readBinaryFile: vi.fn(async ({ path }: { path: string }) => {
      readCalls.push(path);
      return behaviors.readBinary?.(path) ?? null;
    }),
    readFile: vi.fn(),
    readTextFile: vi.fn(),
    writeFile: vi.fn(),
    writeBinaryFile: vi.fn(),
    writeTextFile: vi.fn(
      async ({ path, content }: { path: string; content: string }) => {
        writeCalls.push({ path, content });
      },
    ),
    spawn: vi.fn(),
  } as unknown as Experimental_SandboxSession;

  return { sandbox, runCalls, readCalls, writeCalls };
}

const hostWorkDir = '/tmp/pi-test-host';
const sandboxWorkDir = '/sandbox/workspace';

function makeOps(behaviors: Parameters<typeof makeMockSandbox>[0]) {
  const env = makeMockSandbox(behaviors);
  const paths = createPiPathMapper({
    hostWorkDir,
    sandboxWorkDir,
    readableRoots: [{ sandboxDir: '/home/vercel-sandbox/.agents/skills' }],
  });
  const ops = createPiRemoteOps({ sandbox: env.sandbox, paths });
  return { ...env, paths, ops };
}

describe('createPiRemoteOps.readBuffer', () => {
  it('reads via readBinaryFile and returns a Buffer', async () => {
    const env = makeOps({
      readBinary: p =>
        p === `${sandboxWorkDir}/hello.txt`
          ? new TextEncoder().encode('hi')
          : null,
    });
    const buf = await env.ops.readBuffer('hello.txt');
    expect(buf.toString('utf8')).toBe('hi');
  });

  it('throws when file does not exist', async () => {
    const env = makeOps({ readBinary: () => null });
    await expect(env.ops.readBuffer('nope.txt')).rejects.toThrow(
      /Path not found/,
    );
  });

  it('reads configured sandbox skill roots', async () => {
    const skillPath =
      '/home/vercel-sandbox/.agents/skills/weather-codes/SKILL.md';
    const env = makeOps({
      readBinary: p =>
        p === skillPath ? new TextEncoder().encode('skill') : null,
    });
    const buf = await env.ops.readBuffer(skillPath);
    expect(buf.toString('utf8')).toBe('skill');
  });
});

describe('createPiRemoteOps.writeFile', () => {
  it('mkdir -p the parent and writes via writeTextFile', async () => {
    const env = makeOps({ readBinary: () => null });
    await env.ops.writeFile('src/new.ts', 'export {};');
    expect(env.runCalls[0]?.command).toContain('mkdir -p');
    expect(env.runCalls[0]?.command).toContain(`'${sandboxWorkDir}/src'`);
    expect(env.writeCalls).toEqual([
      { path: `${sandboxWorkDir}/src/new.ts`, content: 'export {};' },
    ]);
  });

  it('fires onFileChange with create when previous is empty', async () => {
    const onFileChange = vi.fn();
    const sandboxEnv = makeMockSandbox({ readBinary: () => null });
    const ops = createPiRemoteOps({
      sandbox: sandboxEnv.sandbox,
      paths: createPiPathMapper({ hostWorkDir, sandboxWorkDir }),
      onFileChange,
    });
    await ops.writeFile('a.txt', 'x');
    expect(onFileChange).toHaveBeenCalledWith(
      'create',
      'a.txt',
      expect.anything(),
    );
  });

  it('fires onFileChange with modify when previous exists', async () => {
    const onFileChange = vi.fn();
    const sandboxEnv = makeMockSandbox({
      readBinary: () => new Uint8Array([1, 2, 3]),
    });
    const ops = createPiRemoteOps({
      sandbox: sandboxEnv.sandbox,
      paths: createPiPathMapper({ hostWorkDir, sandboxWorkDir }),
      onFileChange,
    });
    await ops.writeFile('a.txt', 'x');
    expect(onFileChange).toHaveBeenCalledWith(
      'modify',
      'a.txt',
      expect.anything(),
    );
  });
});

describe('createPiRemoteOps.editFile', () => {
  it('replaces first occurrence and writes back', async () => {
    let current = 'old text here, and old text again';
    const sandboxEnv = makeMockSandbox({
      readBinary: () => new TextEncoder().encode(current),
    });
    const ops = createPiRemoteOps({
      sandbox: sandboxEnv.sandbox,
      paths: createPiPathMapper({ hostWorkDir, sandboxWorkDir }),
    });
    const result = await ops.editFile('a.txt', 'old text', 'new text');
    expect(result).toBe('new text here, and old text again');
  });

  it('throws if oldText not found', async () => {
    const sandboxEnv = makeMockSandbox({
      readBinary: () => new TextEncoder().encode('hello'),
    });
    const ops = createPiRemoteOps({
      sandbox: sandboxEnv.sandbox,
      paths: createPiPathMapper({ hostWorkDir, sandboxWorkDir }),
    });
    await expect(ops.editFile('a.txt', 'missing', 'x')).rejects.toThrow(
      /not found/,
    );
  });
});

describe('createPiRemoteOps.listDirectory', () => {
  it('uses ls -1Ap inside the sandbox and parses output (preserves trailing / for dirs)', async () => {
    const env = makeOps({
      run: () => ({ stdout: 'src/\nREADME.md\nnode_modules/\n' }),
    });
    const names = await env.ops.listDirectory('.');
    expect(names).toEqual(['node_modules/', 'README.md', 'src/']);
    expect(env.runCalls[0]?.command).toContain('ls -1Ap');
  });

  it('throws on __PI_LS_NOT_FOUND__ sentinel', async () => {
    const env = makeOps({
      run: () => ({ stdout: '__PI_LS_NOT_FOUND__\n', exitCode: 2 }),
    });
    await expect(env.ops.listDirectory('nope')).rejects.toThrow(
      /Path not found/,
    );
  });
});

describe('createPiRemoteOps.grepFiles', () => {
  it('builds the grep command with the requested flags', async () => {
    const env = makeOps({
      run: () => ({ stdout: 'foo.ts:1:hit\n' }),
    });
    const out = await env.ops.grepFiles('TODO', {
      ignoreCase: true,
      literal: true,
      context: 2,
      glob: '*.ts',
      limit: 50,
    });
    expect(out).toContain('foo.ts:1:hit');
    // The inner command is wrapped in `bash -lc '...'`, so its single quotes
    // get escaped to `'\''` in the outer string. We just look for the
    // signature substrings without quoting.
    const cmd = env.runCalls[0]?.command ?? '';
    expect(cmd).toContain('grep');
    expect(cmd).toContain('-R');
    expect(cmd).toContain('-i');
    expect(cmd).toContain('-F');
    expect(cmd).toContain('-C');
    expect(cmd).toContain('--include');
    expect(cmd).toContain('*.ts');
    expect(cmd).toContain('head -n 50');
  });

  it('returns "No matches found" on empty output', async () => {
    const env = makeOps({ run: () => ({ stdout: '' }) });
    const out = await env.ops.grepFiles('x', {});
    expect(out).toBe('No matches found');
  });
});

describe('createPiRemoteOps.exec', () => {
  it('runs through bash -lc and returns exit code', async () => {
    const env = makeOps({ run: () => ({ stdout: 'hello\n', exitCode: 0 }) });
    const chunks: Buffer[] = [];
    const result = await env.ops.exec('echo hello', '.', {
      onData: data => chunks.push(data),
    });
    expect(result).toEqual({ exitCode: 0 });
    expect(Buffer.concat(chunks).toString('utf8')).toBe('hello\n');
  });

  it('schedules the abort timeout in seconds, not milliseconds', async () => {
    const env = makeOps({ run: () => ({ stdout: '', exitCode: 0 }) });
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    try {
      await env.ops.exec('echo hi', '.', {
        onData: () => {},
        // The model passes the timeout in seconds; a 30-second timeout must be
        // scheduled 30_000 ms out, not 30 ms (which would abort instantly).
        timeout: 30,
      });
      const delays = setTimeoutSpy.mock.calls.map(call => call[1]);
      expect(delays).toContain(30_000);
      expect(delays).not.toContain(30);
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });
});
