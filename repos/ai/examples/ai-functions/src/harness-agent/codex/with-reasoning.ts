import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createCodex } from '@ai-sdk/harness-codex';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';

run(async () => {
  const sandbox = createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
    timeout: 10 * 60 * 1000,
  });
  const agent = new HarnessAgent({
    harness: createCodex({ reasoningEffort: 'high' }),
    sandbox,
  });

  let exitCode = 0;
  const session = await agent.createSession();
  try {
    const result = await agent.stream({
      session,
      prompt:
        'Plan a multi-step path from A to B where A=(0,0) and B=(3,4) on a grid, moving only N/S/E/W. ' +
        'Explain your reasoning, then give the final path.',
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
