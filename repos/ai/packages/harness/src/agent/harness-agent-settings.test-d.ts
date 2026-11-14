import type { HarnessV1, HarnessV1SandboxProvider } from '../v1';
import type { HarnessAgentSettings } from './harness-agent-settings';
import { tool } from '@ai-sdk/provider-utils';
import { describe, expectTypeOf, test } from 'vitest';
import { z } from 'zod/v4';

const builtinTools = {
  bash: tool({
    inputSchema: z.object({ command: z.string() }),
  }),
};

const harness = {
  specificationVersion: 'harness-v1',
  harnessId: 'mock',
  builtinTools,
  doStart: async () => undefined as never,
} satisfies HarnessV1<typeof builtinTools>;

const userTools = {
  echo: tool({
    inputSchema: z.object({ value: z.string() }),
  }),
};

const sandbox = undefined as never as HarnessV1SandboxProvider;

type Settings = HarnessAgentSettings<typeof harness, typeof userTools>;

describe('HarnessAgentSettings tool filtering types', () => {
  test('activeTools accepts builtin and user tool names', () => {
    const settings: Settings = {
      harness,
      tools: userTools,
      activeTools: ['bash', 'echo'],
      sandbox,
    };

    expectTypeOf(settings).toMatchTypeOf<Settings>();
  });

  test('inactiveTools accepts builtin and user tool names', () => {
    const settings: Settings = {
      harness,
      tools: userTools,
      inactiveTools: ['bash', 'echo'],
      sandbox,
    };

    expectTypeOf(settings).toMatchTypeOf<Settings>();
  });

  test('unknown tool names are rejected', () => {
    const settings: Settings = {
      harness,
      tools: userTools,
      // @ts-expect-error activeTools only accepts configured tool names
      activeTools: ['missing'],
      sandbox,
    };

    expectTypeOf(settings).toMatchTypeOf<Settings>();
  });

  test('activeTools and inactiveTools are mutually exclusive', () => {
    // @ts-expect-error activeTools and inactiveTools cannot be combined
    const settings: Settings = {
      harness,
      tools: userTools,
      activeTools: ['echo'],
      inactiveTools: ['bash'],
      sandbox,
    };

    expectTypeOf(settings).toMatchTypeOf<Settings>();
  });
});
