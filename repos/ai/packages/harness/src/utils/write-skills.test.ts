import { describe, expect, it } from 'vitest';
import type { Experimental_SandboxSession } from '@ai-sdk/provider-utils';
import { writeSkills } from './write-skills';

function makeSandbox({
  runs,
  writes,
}: {
  runs: string[];
  writes: Array<{ path: string; content: string }>;
}): Experimental_SandboxSession {
  return {
    async run({ command }: { command: string }) {
      runs.push(command);
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    async writeTextFile({ path, content }: { path: string; content: string }) {
      writes.push({ path, content });
    },
  } as unknown as Experimental_SandboxSession;
}

describe('writeSkills', () => {
  it('writes skill markdown and additional files under the provided root', async () => {
    const runs: string[] = [];
    const writes: Array<{ path: string; content: string }> = [];

    await writeSkills({
      sandbox: makeSandbox({ runs, writes }),
      rootDir: '/home/user/.agents/skills',
      skills: [
        {
          name: 'demo',
          description: 'Demo skill.',
          content: 'Use reference.md.',
          files: [{ path: 'reference.md', content: '# Reference' }],
        },
      ],
    });

    expect(runs).toEqual(["mkdir -p '/home/user/.agents/skills'"]);
    expect(writes).toEqual([
      {
        path: '/home/user/.agents/skills/demo/SKILL.md',
        content:
          '---\nname: demo\ndescription: Demo skill.\n---\n\nUse reference.md.',
      },
      {
        path: '/home/user/.agents/skills/demo/reference.md',
        content: '# Reference',
      },
    ]);
  });

  it('validates all skill paths before writing', async () => {
    const runs: string[] = [];
    const writes: Array<{ path: string; content: string }> = [];

    await expect(
      writeSkills({
        sandbox: makeSandbox({ runs, writes }),
        rootDir: '/home/user/.agents/skills',
        skills: [
          {
            name: 'demo',
            description: 'Demo skill.',
            content: 'Use reference.md.',
            files: [{ path: '../reference.md', content: '# Reference' }],
          },
        ],
      }),
    ).rejects.toThrow('Invalid skill file path');
    expect(runs).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('supports stricter skill-name patterns', async () => {
    await expect(
      writeSkills({
        sandbox: makeSandbox({ runs: [], writes: [] }),
        rootDir: '/skills',
        skillNamePattern: /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/,
        invalidSkillNameMessage: ({ name }) =>
          `Invalid deepagents skill name '${name}': must be lowercase alphanumeric with hyphens, 1-64 chars.`,
        skills: [{ name: 'Demo', description: 'Demo.', content: 'Demo.' }],
      }),
    ).rejects.toThrow("Invalid deepagents skill name 'Demo'");
  });

  it('can strip leading slashes from attached file paths', async () => {
    const writes: Array<{ path: string; content: string }> = [];

    await writeSkills({
      sandbox: makeSandbox({ runs: [], writes }),
      rootDir: '/skills',
      filePathMode: 'strip-leading-slashes',
      skills: [
        {
          name: 'demo',
          description: 'Demo.',
          content: 'Demo.',
          files: [{ path: '/reference.md', content: '# Reference' }],
        },
      ],
    });

    expect(writes.at(1)?.path).toBe('/skills/demo/reference.md');
  });
});
