import { describe, expect, it } from 'vitest';
import type { HarnessV1StreamPart } from '../../v1';
import { stripWorkDir } from './strip-work-dir';

const WORK_DIR = '/vercel/sandbox/claude-code-abc123';

describe('stripWorkDir', () => {
  it('strips the prefix from a tool-call input string', () => {
    const part: HarnessV1StreamPart = {
      type: 'tool-call',
      toolCallId: 'c1',
      toolName: 'readFile',
      input: JSON.stringify({ path: `${WORK_DIR}/src/foo.ts` }),
    };
    const out = stripWorkDir(part, WORK_DIR);
    expect(out).toEqual({
      type: 'tool-call',
      toolCallId: 'c1',
      toolName: 'readFile',
      input: JSON.stringify({ path: 'src/foo.ts' }),
    });
  });

  it('strips every occurrence in free-form tool-result string output', () => {
    const part: HarnessV1StreamPart = {
      type: 'tool-result',
      toolCallId: 'c1',
      toolName: 'bash',
      result: `${WORK_DIR}/a.ts\n${WORK_DIR}/b.ts\n`,
    };
    const out = stripWorkDir(part, WORK_DIR) as Extract<
      HarnessV1StreamPart,
      { type: 'tool-result' }
    >;
    expect(out.result).toBe('a.ts\nb.ts\n');
  });

  it('strips paths nested in objects and arrays of a tool-result', () => {
    const part: HarnessV1StreamPart = {
      type: 'tool-result',
      toolCallId: 'c1',
      toolName: 'grep',
      result: {
        matches: [
          { file: `${WORK_DIR}/src/a.ts`, line: 1 },
          { file: `${WORK_DIR}/src/b.ts`, line: 2 },
        ],
        cwd: WORK_DIR,
      },
    };
    const out = stripWorkDir(part, WORK_DIR) as Extract<
      HarnessV1StreamPart,
      { type: 'tool-result' }
    >;
    expect(out.result).toEqual({
      matches: [
        { file: 'src/a.ts', line: 1 },
        { file: 'src/b.ts', line: 2 },
      ],
      cwd: '.',
    });
  });

  it('maps a bare reference to the work dir to "."', () => {
    const part: HarnessV1StreamPart = {
      type: 'file-change',
      event: 'modify',
      path: WORK_DIR,
    };
    const out = stripWorkDir(part, WORK_DIR) as Extract<
      HarnessV1StreamPart,
      { type: 'file-change' }
    >;
    expect(out.path).toBe('.');
  });

  it('strips the prefix from a file-change path', () => {
    const part: HarnessV1StreamPart = {
      type: 'file-change',
      event: 'create',
      path: `${WORK_DIR}/notes.md`,
    };
    const out = stripWorkDir(part, WORK_DIR) as Extract<
      HarnessV1StreamPart,
      { type: 'file-change' }
    >;
    expect(out.path).toBe('notes.md');
  });

  it('passes through variants with no path-bearing fields unchanged', () => {
    const part: HarnessV1StreamPart = {
      type: 'text-delta',
      id: 't1',
      delta: `wrote ${WORK_DIR}/foo.ts`,
    };
    expect(stripWorkDir(part, WORK_DIR)).toBe(part);
  });
});
