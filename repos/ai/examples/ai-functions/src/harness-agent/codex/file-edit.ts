import { HarnessAgent } from '@ai-sdk/harness/agent';
import { codex } from '@ai-sdk/harness-codex';
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
    harness: codex,
    sandbox,
  });

  let exitCode = 0;
  const session = await agent.createSession();
  try {
    console.log('--- turn 1: create ---');
    const first = await agent.stream({
      session,
      prompt: 'Create a file at `notes.md` containing the text "hello world".',
    });
    await printFullStream({ result: first });

    console.log('--- turn 2: edit ---');
    const second = await agent.stream({
      session,
      prompt: 'Edit `notes.md` to replace "hello" with "Hello" (capitalized).',
    });
    await printFullStream({ result: second });

    console.log('--- turn 3: read ---');
    const third = await agent.stream({
      session,
      prompt: 'Read `notes.md` and print its contents in your reply.',
    });
    await printFullStream({ result: third });
  } catch (err) {
    exitCode = 1;
    console.error('[example] failed:', err);
  } finally {
    await session.destroy();
    process.exit(exitCode);
  }
});
