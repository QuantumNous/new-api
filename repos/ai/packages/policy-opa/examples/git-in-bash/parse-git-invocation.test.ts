import { describe, expect, it } from 'vitest';
import { bashCommandToInput, parseGitInvocation } from './parse-git-invocation';

describe('parseGitInvocation', () => {
  it('parses a clean single git invocation', () => {
    expect(parseGitInvocation('git status')).toEqual({
      subcommand: 'status',
      args: [],
    });
    expect(parseGitInvocation('git log --oneline -n 5')).toEqual({
      subcommand: 'log',
      args: ['--oneline', '-n', '5'],
    });
  });

  it('returns null for a bare git with no subcommand', () => {
    expect(parseGitInvocation('git')).toBeNull();
  });

  it('returns null for a non-git program', () => {
    expect(parseGitInvocation('ls -la')).toBeNull();
    expect(parseGitInvocation('/usr/bin/git status')).toBeNull();
  });

  it('fails closed on compound and obfuscated commands', () => {
    for (const command of [
      'cd /tmp && git clone https://x',
      'git status; git clone https://x',
      'git status | sh',
      'git $(echo clone) https://x',
      'git status `whoami`',
      'git status > /tmp/out',
      'git status \\\n clone',
    ]) {
      expect(parseGitInvocation(command)).toBeNull();
    }
  });
});

describe('bashCommandToInput', () => {
  it('maps a clean git command to a git action', () => {
    expect(bashCommandToInput('git clone https://x')).toEqual({
      kind: 'git',
      subcommand: 'clone',
      args: ['https://x'],
    });
  });

  it('maps anything unparseable to a bash action (policy denies by default)', () => {
    expect(bashCommandToInput('cd /tmp && git clone https://x')).toEqual({
      kind: 'bash',
      command: 'cd /tmp && git clone https://x',
    });
  });
});
