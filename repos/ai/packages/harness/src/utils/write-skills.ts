import path from 'node:path';
import type { Experimental_SandboxSession } from '@ai-sdk/provider-utils';
import type { HarnessV1Skill } from '../v1';
import { shellQuote } from './shell-quote';

export type SkillFilePathMode = 'relative' | 'strip-leading-slashes';

export type WriteSkillsOptions = {
  sandbox: Experimental_SandboxSession;
  rootDir: string;
  skills: ReadonlyArray<HarnessV1Skill>;
  abortSignal?: AbortSignal;
  skillNamePattern?: RegExp;
  invalidSkillNameMessage?: (input: { name: string }) => string;
  filePathMode?: SkillFilePathMode;
  invalidSkillFilePathMessage?: (input: {
    skillName: string;
    filePath: string;
  }) => string;
  trailingNewline?: boolean;
};

export async function writeSkills({
  sandbox,
  rootDir,
  skills,
  abortSignal,
  skillNamePattern = /^[A-Za-z0-9._-]+$/,
  invalidSkillNameMessage = ({ name }) => `Invalid skill name: ${name}`,
  filePathMode = 'relative',
  invalidSkillFilePathMessage = ({ skillName, filePath }) =>
    `Invalid skill file path for ${skillName}: ${filePath}`,
  trailingNewline = false,
}: WriteSkillsOptions): Promise<void> {
  for (const skill of skills) {
    validateSkillName({
      name: skill.name,
      pattern: skillNamePattern,
      message: invalidSkillNameMessage,
    });
    for (const file of skill.files ?? []) {
      normalizeSkillFilePath({
        skillName: skill.name,
        filePath: file.path,
        mode: filePathMode,
        message: invalidSkillFilePathMessage,
      });
    }
  }

  await sandbox.run({
    command: `mkdir -p ${shellQuote(rootDir)}`,
    abortSignal,
  });

  for (const skill of skills) {
    const name = validateSkillName({
      name: skill.name,
      pattern: skillNamePattern,
      message: invalidSkillNameMessage,
    });
    const skillDir = path.posix.join(rootDir, name);
    await sandbox.writeTextFile({
      path: path.posix.join(skillDir, 'SKILL.md'),
      content: renderSkillFile({ skill, trailingNewline }),
      abortSignal,
    });

    for (const file of skill.files ?? []) {
      const filePath = normalizeSkillFilePath({
        skillName: skill.name,
        filePath: file.path,
        mode: filePathMode,
        message: invalidSkillFilePathMessage,
      });
      await sandbox.writeTextFile({
        path: path.posix.join(skillDir, filePath),
        content: file.content,
        abortSignal,
      });
    }
  }
}

function validateSkillName({
  name,
  pattern,
  message,
}: {
  name: string;
  pattern: RegExp;
  message?: (input: { name: string }) => string;
}): string {
  if (!pattern.test(name) || name === '.' || name === '..') {
    throw new Error(message?.({ name }) ?? `Invalid skill name: ${name}`);
  }
  return name;
}

function normalizeSkillFilePath({
  skillName,
  filePath,
  mode,
  message,
}: {
  skillName?: string;
  filePath: string;
  mode: SkillFilePathMode;
  message?: (input: { skillName: string; filePath: string }) => string;
}): string {
  const normalized =
    mode === 'strip-leading-slashes'
      ? filePath.replace(/^\/+/, '')
      : path.posix.normalize(filePath);
  const invalid =
    normalized === '' ||
    (mode === 'relative' && normalized === '.') ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized.endsWith('/..') ||
    (mode === 'relative' && path.posix.isAbsolute(normalized));

  if (invalid) {
    throw new Error(
      message?.({ skillName: skillName ?? '', filePath }) ??
        `Invalid skill file path for ${skillName}: ${filePath}`,
    );
  }
  return normalized;
}

function renderSkillFile({
  skill,
  trailingNewline,
}: {
  skill: HarnessV1Skill;
  trailingNewline: boolean;
}): string {
  const content = `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.content}`;
  return trailingNewline ? `${content}\n` : content;
}
