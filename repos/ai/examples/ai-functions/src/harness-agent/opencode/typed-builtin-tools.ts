import { HarnessAgent } from '@ai-sdk/harness/agent';
import { openCode } from '@ai-sdk/harness-opencode';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import { tool } from 'ai';
import { z } from 'zod';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

/*
 * OpenCode twin of the typed-builtin-tools example. OpenCode's builtin tool
 * set includes file, shell, search, web fetch, and subagent tools; user tools
 * merge cleanly. TypeScript narrows `toolName` and `input` per tool across
 * both surfaces.
 */
run(async () => {
  const sandbox = createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
    timeout: 10 * 60 * 1000,
  });

  const echo = tool({
    description: 'Return the given message back to the model.',
    inputSchema: z.object({ message: z.string() }),
    execute: async ({ message }: { message: string }) => ({ message }),
  });

  const agent = new HarnessAgent({
    harness: openCode,
    sandbox,
    tools: { echo },
  });

  let exitCode = 0;
  const session = await agent.createSession();
  try {
    const result = await agent.stream({
      session,
      prompt:
        'Call the `echo` tool with the message "hello", then run `uname -a` and tell me the kernel.',
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
