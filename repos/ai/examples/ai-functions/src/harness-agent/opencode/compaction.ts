import { HarnessAgent } from '@ai-sdk/harness/agent';
import { openCode } from '@ai-sdk/harness-opencode';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';

/*
 * Context compaction (OpenCode).
 *
 * OpenCode performs context compaction natively. The harness observes it
 * and surfaces a single `compaction` event, which `streamText`-style consumers
 * see as a synthetic `compaction` tool-call / tool-result pair (printed below
 * under "TOOL CALL" / "TOOL RESULT"): the result carries
 * `{ trigger, summary, tokensBefore?, tokensAfter? }`.
 *
 * Triggering: `session.compact()` calls OpenCode's native compaction API.
 * OpenCode compaction is session-scoped, so this example compacts between
 * turns and observes the buffered compaction event on the next stream.
 */
run(async () => {
  const sandbox = createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
    timeout: 10 * 60 * 1000,
  });
  const agent = new HarnessAgent({ harness: openCode, sandbox });

  let exitCode = 0;
  const session = await agent.createSession();
  try {
    console.log('--- turn 1: build up some context ---');
    const first = await agent.stream({
      session,
      prompt:
        'In about 8 sentences, explain how a modern CPU pipeline executes an instruction.',
    });
    await printFullStream({ result: first });

    console.log('\n--- compacting between turns ---');
    await session.compact();

    console.log(
      '\n--- turn 2: the buffered compaction is observed on this stream ---',
    );
    const second = await agent.stream({
      session,
      prompt: 'Now write a short haiku about that explanation.',
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
