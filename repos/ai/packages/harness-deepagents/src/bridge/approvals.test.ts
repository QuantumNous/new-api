import { describe, expect, it } from 'vitest';
import {
  buildInterruptOn,
  builtinToolRequiresApproval,
  collectActionRequests,
  isBuiltinToolIncluded,
} from './approvals';

describe('builtinToolRequiresApproval', () => {
  it('never requires approval under allow-all', () => {
    expect(builtinToolRequiresApproval('readonly', 'allow-all')).toBe(false);
    expect(builtinToolRequiresApproval('edit', 'allow-all')).toBe(false);
    expect(builtinToolRequiresApproval('bash', 'allow-all')).toBe(false);
  });

  it('only gates bash under allow-edits', () => {
    expect(builtinToolRequiresApproval('readonly', 'allow-edits')).toBe(false);
    expect(builtinToolRequiresApproval('edit', 'allow-edits')).toBe(false);
    expect(builtinToolRequiresApproval('bash', 'allow-edits')).toBe(true);
  });

  it('gates edit and bash under allow-reads', () => {
    expect(builtinToolRequiresApproval('readonly', 'allow-reads')).toBe(false);
    expect(builtinToolRequiresApproval('edit', 'allow-reads')).toBe(true);
    expect(builtinToolRequiresApproval('bash', 'allow-reads')).toBe(true);
  });
});

describe('buildInterruptOn', () => {
  it('returns undefined when no gating is needed', () => {
    expect(buildInterruptOn(undefined, undefined)).toBeUndefined();
    expect(buildInterruptOn('allow-all', undefined)).toBeUndefined();
  });

  it('gates only execute under allow-edits', () => {
    expect(buildInterruptOn('allow-edits', undefined)).toEqual({
      execute: { allowedDecisions: ['approve', 'reject'] },
    });
  });

  it('gates write, edit, and execute under allow-reads', () => {
    expect(buildInterruptOn('allow-reads', undefined)).toEqual({
      write_file: { allowedDecisions: ['approve', 'reject'] },
      edit_file: { allowedDecisions: ['approve', 'reject'] },
      execute: { allowedDecisions: ['approve', 'reject'] },
      task: { allowedDecisions: ['approve', 'reject'] },
      write_todos: { allowedDecisions: ['approve', 'reject'] },
    });
  });

  it('does not gate inactive built-in tools from the filtering policy alone', () => {
    expect(
      buildInterruptOn(undefined, { mode: 'deny', toolNames: ['read'] }),
    ).toBeUndefined();
  });

  it('excludes inactive built-in tools from permission approval gating', () => {
    expect(
      buildInterruptOn('allow-reads', { mode: 'deny', toolNames: ['write'] }),
    ).toEqual({
      edit_file: { allowedDecisions: ['approve', 'reject'] },
      execute: { allowedDecisions: ['approve', 'reject'] },
      task: { allowedDecisions: ['approve', 'reject'] },
      write_todos: { allowedDecisions: ['approve', 'reject'] },
    });
  });
});

describe('isBuiltinToolIncluded', () => {
  it('includes every built-in when no filtering policy is configured', () => {
    expect(
      isBuiltinToolIncluded({
        nativeName: 'read_file',
        toolFiltering: undefined,
      }),
    ).toBe(true);
  });

  it('maps native names to common names for allow policies', () => {
    expect(
      isBuiltinToolIncluded({
        nativeName: 'read_file',
        toolFiltering: { mode: 'allow', toolNames: ['read'] },
      }),
    ).toBe(true);
    expect(
      isBuiltinToolIncluded({
        nativeName: 'glob',
        toolFiltering: { mode: 'allow', toolNames: ['read'] },
      }),
    ).toBe(false);
  });

  it('maps native names to common names for deny policies', () => {
    expect(
      isBuiltinToolIncluded({
        nativeName: 'execute',
        toolFiltering: { mode: 'deny', toolNames: ['bash'] },
      }),
    ).toBe(false);
    expect(
      isBuiltinToolIncluded({
        nativeName: 'grep',
        toolFiltering: { mode: 'deny', toolNames: ['bash'] },
      }),
    ).toBe(true);
  });

  it('applies policies to native-only built-in names', () => {
    expect(
      isBuiltinToolIncluded({
        nativeName: 'write_todos',
        toolFiltering: { mode: 'allow', toolNames: ['write_todos'] },
      }),
    ).toBe(true);
    expect(
      isBuiltinToolIncluded({
        nativeName: 'task',
        toolFiltering: { mode: 'deny', toolNames: ['task'] },
      }),
    ).toBe(false);
  });
});

describe('collectActionRequests', () => {
  it('flattens action requests across interrupts and defaults missing args', () => {
    expect(
      collectActionRequests([
        {
          value: {
            actionRequests: [
              { name: 'execute', args: { command: 'rm -rf /' } },
              { name: 'write_file' },
            ],
          },
        },
        { value: { actionRequests: [{ name: 'edit_file', args: { a: 1 } }] } },
      ]),
    ).toEqual([
      { name: 'execute', args: { command: 'rm -rf /' } },
      { name: 'write_file', args: {} },
      { name: 'edit_file', args: { a: 1 } },
    ]);
  });

  it('ignores interrupts without action requests', () => {
    expect(
      collectActionRequests([{ value: undefined }, { value: {} }]),
    ).toEqual([]);
  });
});
