import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createDeepAgents } from '@ai-sdk/harness-deepagents';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import { tool } from 'ai';
import { z } from 'zod';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

// Runs a non-Anthropic model through AI Gateway's Anthropic-compatible endpoint.
// Requires AI_GATEWAY_API_KEY (or VERCEL_OIDC_TOKEN) in the environment.
run(async () => {
  const sandbox = createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
    timeout: 10 * 60 * 1000,
  });
  const weather = tool({
    description: 'Get the current temperature for a city.',
    inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }: { city: string }) => {
      const temps: Record<string, number> = {
        Paris: 12,
        Tokyo: 18,
        Reykjavik: 3,
      };
      return { city, celsius: temps[city] ?? 20 };
    },
  });

  const agent = new HarnessAgent({
    harness: createDeepAgents({
      model: process.env.PROBE_MODEL ?? 'google/gemini-2.5-flash',
    }),
    sandbox,
    tools: { weather },
  });

  let exitCode = 0;
  const session = await agent.createSession();
  try {
    const result = await agent.stream({
      session,
      prompt:
        'What is the weather in Paris? Use the `weather` tool, then summarize in one sentence.',
    });

    await printFullStream({ result });

    console.log('steps:', (await result.steps).length);
  } catch (err) {
    exitCode = 1;
    console.error('[example] failed:', err);
  } finally {
    await session.destroy();
    process.exit(exitCode);
  }
});
