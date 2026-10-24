import { anthropic } from '@ai-sdk/anthropic';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createJustBashSandbox } from '@ai-sdk/sandbox-just-bash';
import { tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';
import { mockHarness } from './mock-harness';

run(async () => {
  const weather = tool({
    description: 'Get the current temperature for a city',
    inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }: { city: string }) => {
      // Deterministic stub to keep the example offline-free.
      const temps: Record<string, number> = {
        Paris: 12,
        Tokyo: 18,
        Reykjavik: 3,
      };
      return { city, celsius: temps[city] ?? 20 };
    },
  });

  // The mock harness passes tools through to streamText, which handles
  // execution. HarnessAgent's host-tool path is exercised by unit tests.
  const tools = { weather } as const;
  const agent = new HarnessAgent({
    harness: mockHarness({
      model: anthropic('claude-opus-4-7'),
      tools,
    }),
    tools,
    sandbox: createJustBashSandbox(),
  });

  const session = await agent.createSession();
  try {
    const result = await agent.generate({
      session,
      prompt:
        'What is the weather in Paris and Reykjavik? Use the tool, then summarize.',
    });
    console.log('text:', result.text);
    console.log('toolCalls:', result.toolCalls);
    console.log('toolResults:', result.toolResults);
    console.log('steps:', result.steps.length);
    console.log('finishReason:', result.finishReason);
  } finally {
    await session.destroy();
  }
});
