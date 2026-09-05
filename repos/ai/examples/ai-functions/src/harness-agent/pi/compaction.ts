import { HarnessAgent } from '@ai-sdk/harness/agent';
import { pi } from '@ai-sdk/harness-pi';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';

/*
 * Context compaction (Pi).
 *
 * Pi performs context compaction natively (and automatically, when the context
 * window fills). The harness observes it and surfaces a single `compaction`
 * event, which `streamText`-style consumers see as a synthetic `compaction`
 * tool-call / tool-result pair (printed below under "TOOL CALL" / "TOOL
 * RESULT"): the result carries `{ trigger, summary, tokensBefore? }` (Pi does
 * not report `tokensAfter`).
 *
 * Triggering: `session.compact(customInstructions?)` calls Pi's native
 * `session.compact()`. Pi aborts the current turn before it summarizes, so a
 * manual compaction is reported on the *next* turn's stream (the harness
 * buffers the observation when no turn is active). This example therefore
 * compacts between turns, then runs a follow-up turn to observe it. (For Codex
 * the same call throws `HarnessCapabilityUnsupportedError` — Codex auto-compacts
 * internally but exposes no manual trigger.)
 *
 * NOTE on the summary: Pi keeps the most recent ~20k tokens (its
 * `keepRecentTokens` default) verbatim and only summarizes content OLDER than
 * that window. This short two-turn conversation is well under 20k, so there is
 * nothing old enough to summarize and the `summary` is an empty-template
 * "nothing to summarize" — expected, not a lost history (`tokensBefore` still
 * reflects the full context). Manual compaction produces a real summary once
 * the conversation exceeds ~20k tokens. This is unrelated to Pi's AUTOMATIC
 * compaction, which only fires near the context-window ceiling
 * (`contextWindow - 16384`, e.g. ~184k tokens for a 200k-window model) — so
 * manual compaction is useful across the large range in between.
 */
run(async () => {
  const sandbox = createVercelSandbox({
    runtime: 'node24',
    timeout: 10 * 60 * 1000,
  });
  const agent = new HarnessAgent({ harness: pi, sandbox });

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
    await session.compact('Keep the key technical facts.');

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
