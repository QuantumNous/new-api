import { describe, expect, it } from 'vitest';
import type { Experimental_SandboxSession } from '@ai-sdk/provider-utils';
import { writePiSkills } from './pi-skills';

function makeSandbox({
  writes,
  runs = [],
}: {
  writes: Array<{ path: string; content: string }>;
  runs?: string[];
}) {
  return {
    async run(input: { command: string }) {
      runs.push(input.command);
      return { stdout: '', stderr: '', exitCode: 0 };
    },
    async writeTextFile(input: { path: string; content: string }) {
      writes.push({ path: input.path, content: input.content });
    },
  } as unknown as Experimental_SandboxSession;
}

describe('writePiSkills', () => {
  it('writes SKILL.md and additional skill files', async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const runs: string[] = [];

    await writePiSkills({
      sandbox: makeSandbox({ writes, runs }),
      sandboxHomeDir: '/home/vercel-sandbox',
      skills: [
        {
          name: 'demo',
          description: 'Demo skill.',
          content: 'Use reference.md.',
          files: [{ path: 'reference.md', content: '# Reference' }],
        },
      ],
    });

    expect(runs).toEqual(["mkdir -p '/home/vercel-sandbox/.agents/skills'"]);
    expect(writes).toEqual([
      {
        path: '/home/vercel-sandbox/.agents/skills/demo/SKILL.md',
        content:
          '---\nname: demo\ndescription: Demo skill.\n---\n\nUse reference.md.',
      },
      {
        path: '/home/vercel-sandbox/.agents/skills/demo/reference.md',
        content: '# Reference',
      },
    ]);
  });

  it('rejects unsafe skill file paths before writing files', async () => {
    const writes: Array<{ path: string; content: string }> = [];

    await expect(
      writePiSkills({
        sandbox: makeSandbox({ writes }),
        sandboxHomeDir: '/home/vercel-sandbox',
        skills: [
          {
            name: 'demo',
            description: 'Demo skill.',
            content: 'Use reference.md.',
            files: [{ path: '../reference.md', content: '# Reference' }],
          },
        ],
      }),
    ).rejects.toThrow('Invalid Pi skill file path');
    expect(writes).toEqual([]);
  });
});
