import { HarnessAgent } from '@ai-sdk/harness/agent';
import { claudeCode } from '@ai-sdk/harness-claude-code';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import { Sandbox } from '@vercel/sandbox';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const sandbox = await Sandbox.create({
    runtime: 'node24',
    ports: [4000],
    timeout: 10 * 60 * 1000,
  });

  const agent = new HarnessAgent({
    harness: claudeCode,
    sandbox: createVercelSandbox({ sandbox }),
  });

  let exitCode = 0;
  const session = await agent.createSession();
  try {
    const result = await agent.stream({
      session,
      prompt: 'In one sentence, what is the capital of France?',
    });

    await printFullStream({ result });

    console.log('finishReason:', await result.finishReason);
    console.log('usage:', await result.usage);
  } catch (err) {
    exitCode = 1;
    console.error('[example] failed:', err);
  } finally {
    await session.destroy();
    await sandbox.stop().catch(() => {});
    process.exit(exitCode);
  }
});
