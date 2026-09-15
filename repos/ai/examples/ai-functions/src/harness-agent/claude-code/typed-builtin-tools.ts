import { HarnessAgent } from '@ai-sdk/harness/agent';
import { claudeCode } from '@ai-sdk/harness-claude-code';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import { tool } from 'ai';
import { z } from 'zod';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

/*
 * Demonstrates that a HarnessAgent's `fullStream` exposes both the harness's
 * built-in tool calls (Claude Code's `Bash`/`Read`/…) and user-defined tool
 * calls under a single, fully-typed union. The `toolName` field narrows to
 * the known names; the `input` field narrows per tool to the declared
 * schema. No casts.
 */
run(async () => {
  const sandbox = createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
    timeout: 10 * 60 * 1000,
  });

  const today = tool({
    description: 'Return the current date in ISO format.',
    inputSchema: z.object({}),
    execute: async () => ({ iso: new Date().toISOString().slice(0, 10) }),
  });

  const agent = new HarnessAgent({
    harness: claudeCode,
    sandbox,
    tools: { today },
  });

  let exitCode = 0;
  const session = await agent.createSession();
  try {
    const result = await agent.stream({
      session,
      prompt:
        'Use the `today` tool, then create a file `notes.md` containing the date you got back.',
    });

    await printFullStream({ result });
  } catch (err) {
    exitCode = 1;
    console.error('[example] failed:', err);
  } finally {
    await session.destroy();
    process.exit(exitCode);
  }
});
