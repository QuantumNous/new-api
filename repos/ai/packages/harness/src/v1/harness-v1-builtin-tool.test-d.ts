import { z } from 'zod/v4';
import { assertType, describe, expectTypeOf, test } from 'vitest';
import {
  commonTool,
  type HarnessV1BuiltinTool,
  type HarnessV1BuiltinToolName,
  type HARNESS_V1_BUILTIN_TOOL_NAMES,
  type HARNESS_V1_BUILTIN_TOOLS,
} from './harness-v1-builtin-tool';

describe('HARNESS_V1_BUILTIN_TOOLS', () => {
  test('names are derived from the registry keys', () => {
    expectTypeOf<HarnessV1BuiltinToolName>().toEqualTypeOf<
      keyof typeof HARNESS_V1_BUILTIN_TOOLS
    >();
    expectTypeOf<
      (typeof HARNESS_V1_BUILTIN_TOOL_NAMES)[number]
    >().toEqualTypeOf<HarnessV1BuiltinToolName>();
  });
});

describe('commonTool', () => {
  test('accepts a schema that exactly matches the standard', () => {
    const t = commonTool('read', {
      nativeName: 'Read',
      inputSchema: z.object({ file_path: z.string() }),
    });
    // success branch: the return type is a HarnessV1BuiltinTool
    assertType<HarnessV1BuiltinTool<{ file_path: string }>>(t);
  });

  test('accepts a schema that is a strict superset of the standard', () => {
    const t = commonTool('read', {
      nativeName: 'Read',
      inputSchema: z.object({
        file_path: z.string(),
        offset: z.number().optional(),
      }),
    });
    assertType<HarnessV1BuiltinTool<{ file_path: string; offset?: number }>>(t);
  });

  test('the return type collapses to an error tuple when the schema is missing a required standard field', () => {
    const broken = commonTool('read', {
      nativeName: 'Read',
      inputSchema: z.object({ path: z.string() }),
    });
    // The return type is the tagged error tuple, not a HarnessV1BuiltinTool.
    expectTypeOf(broken).not.toMatchTypeOf<HarnessV1BuiltinTool>();
    // Assignment to a HarnessV1BuiltinTool fails — that is the load-bearing
    // compile-time guarantee.
    // @ts-expect-error — broken's input type is not a superset of the standard
    const _check: HarnessV1BuiltinTool = broken;
    void _check;
  });

  test('rejects a commonName not in the registry', () => {
    commonTool(
      // @ts-expect-error — 'notARealName' is not a known common tool name
      'notARealName',
      {
        nativeName: 'Whatever',
        inputSchema: z.object({}),
      },
    );
  });
});
