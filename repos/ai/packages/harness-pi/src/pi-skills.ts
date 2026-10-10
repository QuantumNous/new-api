import path from 'node:path';
import type { HarnessV1Skill } from '@ai-sdk/harness';
import { writeSkills } from '@ai-sdk/harness/utils';
import type { Experimental_SandboxSession } from '@ai-sdk/provider-utils';

/**
 * Materialize Pi skills as files under
 * `$HOME/.agents/skills/<name>/SKILL.md` inside the sandbox.
 */
export async function writePiSkills(args: {
  readonly sandbox: Experimental_SandboxSession;
  readonly sandboxHomeDir: string;
  readonly skills: ReadonlyArray<HarnessV1Skill>;
  readonly abortSignal?: AbortSignal;
}): Promise<void> {
  await writeSkills({
    sandbox: args.sandbox,
    rootDir: path.posix.join(args.sandboxHomeDir, '.agents', 'skills'),
    skills: args.skills,
    abortSignal: args.abortSignal,
    invalidSkillNameMessage: ({ name }) => `Invalid Pi skill name: ${name}`,
    invalidSkillFilePathMessage: ({ skillName, filePath }) =>
      `Invalid Pi skill file path for ${skillName}: ${filePath}`,
  });
}
