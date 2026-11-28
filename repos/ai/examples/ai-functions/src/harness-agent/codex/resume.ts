/*
 * Cross-process resume smoke test for the Codex harness.
 *
 * Within a single Node process this example simulates the REST-server
 * flow: turn 1 runs, the session is stopped, the agent reference is dropped,
 * and a fresh `HarnessAgent` instance picks the conversation back up using
 * the persisted `HarnessAgentResumeSessionState`. The resume payload carries the Codex
 * `threadId`; the bridge takes the
 * `codex.resumeThread(...)` branch on the second turn so the model
 * remembers the name from turn 1.
 */
import {
  HarnessAgent,
  type HarnessAgentResumeSessionState,
} from '@ai-sdk/harness/agent';
import { codex } from '@ai-sdk/harness-codex';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const sandbox = createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
    timeout: 10 * 60 * 1000,
  });

  // Turn 1: introduce the name.
  let sessionId: string;
  let resumeState: HarnessAgentResumeSessionState;
  {
    const agent = new HarnessAgent({ harness: codex, sandbox });
    const session = await agent.createSession();
    sessionId = session.sessionId;
    console.log('--- turn 1 ---');
    const result = await agent.stream({
      session,
      prompt: 'My name is Felix. Remember it.',
    });
    await printFullStream({ result });
    resumeState = await session.stop();
    console.log('[stopped] resume state:', JSON.stringify(resumeState));
  }

  // Turn 2: brand-new agent instance, only the persisted state survives.
  {
    const agent = new HarnessAgent({ harness: codex, sandbox });
    const session = await agent.createSession({
      sessionId,
      resumeFrom: resumeState,
    });
    console.log('--- turn 2 (resumed) ---');
    const result = await agent.stream({
      session,
      prompt: 'What is my name? Answer in one word.',
    });
    await printFullStream({ result });
    await session.destroy();
  }

  process.exit(0);
});
