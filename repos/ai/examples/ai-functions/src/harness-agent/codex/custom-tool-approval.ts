import { HarnessAgent } from '@ai-sdk/harness/agent';
import { codex } from '@ai-sdk/harness-codex';
import { tool } from 'ai';
import { z } from 'zod';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';
import {
  createToolApprovalResponseMessages,
  printFullStreamAndCaptureToolApproval,
} from '../../lib/harness-tool-approval';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';

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
    harness: codex,
    sandbox,
    tools: { weather },
    toolApproval: {
      weather: 'user-approval',
    },
  });

  let exitCode = 0;
  const session = await agent.createSession();
  try {
    const first = await agent.stream({
      session,
      prompt:
        'What is the weather in Paris? Use the `weather` tool, then summarize in one sentence.',
    });
    const approval = await printFullStreamAndCaptureToolApproval({
      result: first,
    });
    if (approval == null) {
      throw new Error('Expected a weather tool approval request.');
    }

    const second = await agent.stream({
      session,
      messages: createToolApprovalResponseMessages({
        approval,
        approved: true,
      }),
    });
    await printFullStream({ result: second });
  } catch (err) {
    exitCode = 1;
    console.error('[example] failed:', err);
  } finally {
    await session.destroy();
    process.exit(exitCode);
  }
});
