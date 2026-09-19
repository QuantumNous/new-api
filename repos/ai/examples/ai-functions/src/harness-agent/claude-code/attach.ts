/*
 * Cross-process ATTACH for the Claude Code harness.
 *
 * `session.detach()` parks the bridge and sandbox, returns live coordinates,
 * and makes the current session handle unusable. A fresh `HarnessAgent`
 * (standing in for a different server process) reattaches to the still-running
 * bridge and continues mid-conversation. `session.isResume` reports `true`.
 */
import {
  HarnessAgent,
  type HarnessAgentResumeSessionState,
} from '@ai-sdk/harness/agent';
import { claudeCode } from '@ai-sdk/harness-claude-code';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const sandbox = createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
    timeout: 10 * 60 * 1000,
  });

  // Turn 1: introduce the name, then park the live bridge and sandbox.
  let sessionId: string;
  let resumeState: HarnessAgentResumeSessionState;
  {
    const agent = new HarnessAgent({ harness: claudeCode, sandbox });
    const session = await agent.createSession();
    sessionId = session.sessionId;
    console.log('--- turn 1 ---');
    const result = await agent.stream({
      session,
      prompt: 'My name is Felix. Remember it.',
    });
    await printFullStream({ result });
    resumeState = await session.detach();
    console.log('[handle] live coords:', JSON.stringify(resumeState));
  }

  // Turn 2: brand-new agent instance attaches to the live bridge.
  {
    const agent = new HarnessAgent({ harness: claudeCode, sandbox });
    const session = await agent.createSession({
      sessionId,
      resumeFrom: resumeState,
    });
    console.log('--- turn 2 ---');
    if (!session.isResume) {
      throw new Error('expected resumed session');
    }
    const result = await agent.stream({
      session,
      prompt: 'What is my name? Answer in one word.',
    });
    await printFullStream({ result });
    await session.destroy();
  }

  process.exit(0);
});
