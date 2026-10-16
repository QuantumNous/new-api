import { HarnessAgent } from '@ai-sdk/harness/agent';
import { pi } from '@ai-sdk/harness-pi';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';

run(async () => {
  const sandbox = createVercelSandbox({
    runtime: 'node24',
    timeout: 10 * 60 * 1000,
  });
  const agent = new HarnessAgent({
    harness: pi,
    sandbox,
  });

  let exitCode = 0;
  const session = await agent.createSession();
  try {
    console.log('--- turn 1 ---');
    const first = await agent.stream({
      session,
      prompt: 'My name is Felix. Remember it.',
    });
    await printFullStream({ result: first });

    console.log('--- turn 2 ---');
    const second = await agent.stream({
      session,
      prompt: 'What is my name? Answer in one word.',
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
