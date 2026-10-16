import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPiPathMapper } from './pi-paths';

let hostWorkDir: string;
const sandboxWorkDir = '/sandbox/work/session';

beforeEach(() => {
  hostWorkDir = mkdtempSync(path.join(tmpdir(), 'pi-paths-'));
});

afterEach(() => {
  rmSync(hostWorkDir, { recursive: true, force: true });
});

describe('createPiPathMapper', () => {
  it('translates relative paths to sandbox POSIX paths', () => {
    const mapper = createPiPathMapper({ hostWorkDir, sandboxWorkDir });
    expect(mapper.toSandboxPath('src/foo.ts')).toBe(
      `${sandboxWorkDir}/src/foo.ts`,
    );
  });

  it('handles the workspace root itself', () => {
    const mapper = createPiPathMapper({ hostWorkDir, sandboxWorkDir });
    expect(mapper.toSandboxPath('.')).toBe(sandboxWorkDir);
  });

  it('returns already-sandbox absolute paths inside the sandbox root unchanged', () => {
    const mapper = createPiPathMapper({ hostWorkDir, sandboxWorkDir });
    expect(mapper.toSandboxPath(`${sandboxWorkDir}/already/here.ts`)).toBe(
      `${sandboxWorkDir}/already/here.ts`,
    );
  });

  it('throws when a path escapes the workspace', () => {
    const mapper = createPiPathMapper({ hostWorkDir, sandboxWorkDir });
    expect(() => mapper.toSandboxPath('../escape.ts')).toThrow(
      /escapes the workspace/,
    );
  });

  it('allows configured read-only sandbox roots for readable paths', () => {
    const mapper = createPiPathMapper({
      hostWorkDir,
      sandboxWorkDir,
      readableRoots: [{ sandboxDir: '/home/vercel-sandbox/.agents/skills' }],
    });
    expect(
      mapper.toReadableSandboxPath(
        '/home/vercel-sandbox/.agents/skills/weather-codes/SKILL.md',
      ),
    ).toBe('/home/vercel-sandbox/.agents/skills/weather-codes/SKILL.md');
    expect(() =>
      mapper.toSandboxPath(
        '/home/vercel-sandbox/.agents/skills/weather-codes/SKILL.md',
      ),
    ).toThrow(/escapes the workspace/);
  });

  it('toRelativePath returns "." for the sandbox root', () => {
    const mapper = createPiPathMapper({ hostWorkDir, sandboxWorkDir });
    expect(mapper.toRelativePath(sandboxWorkDir)).toBe('.');
  });

  it('toRelativePath returns POSIX-relative form for nested paths', () => {
    const mapper = createPiPathMapper({ hostWorkDir, sandboxWorkDir });
    expect(mapper.toRelativePath(`${sandboxWorkDir}/a/b/c.ts`)).toBe(
      'a/b/c.ts',
    );
  });
});
