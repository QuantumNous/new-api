import { HarnessAgent } from '@ai-sdk/harness/agent';
import { claudeCode } from '@ai-sdk/harness-claude-code';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';

/*
 * Context compaction (Claude Code).
 *
 * Claude Code performs context compaction natively. The harness observes it
 * and surfaces a single `compaction` event, which `streamText`-style consumers
 * see as a synthetic `compaction` tool-call / tool-result pair (printed below
 * under "TOOL CALL" / "TOOL RESULT"): the result carries
 * `{ trigger, summary, tokensBefore?, tokensAfter? }`.
 *
 * Triggering: the supported manual trigger is the `/compact` slash command.
 * `session.compact(customInstructions?)` is the programmatic equivalent — it
 * injects `/compact` into an in-flight turn (subject to the same mid-turn
 * injection timing as `submitUserMessage`). For a deterministic demonstration
 * this example sends `/compact` as the turn prompt directly.
 */
run(async () => {
  const sandbox = createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
    timeout: 10 * 60 * 1000,
  });
  const agent = new HarnessAgent({ harness: claudeCode, sandbox });

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

    console.log('\n--- turn 2: trigger compaction via /compact ---');
    const second = await agent.stream({
      session,
      prompt: '/compact Keep the key technical facts from the explanation.',
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
