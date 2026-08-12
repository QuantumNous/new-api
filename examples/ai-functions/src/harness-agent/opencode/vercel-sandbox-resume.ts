/*
 * Verifies that access-token credentials configured on Vercel Sandbox survive
 * the HarnessAgent stop/resume lifecycle. No model turn is needed because the
 * credential lookup happens when the new agent instance resumes its sandbox.
 */
import {
  HarnessAgent,
  type HarnessAgentResumeSessionState,
} from '@ai-sdk/harness/agent';
import { openCode } from '@ai-sdk/harness-opencode';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import { run } from '../../lib/run';

run(async () => {
  process.exitCode = 1;

  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (token == null || teamId == null || projectId == null) {
    throw new Error(
      'VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID are required',
    );
  }

  const sandbox = createVercelSandbox({
    token,
    teamId,
    projectId,
    runtime: 'node24',
    ports: [4000],
    timeout: 10 * 60 * 1000,
  });

  let sessionId: string;
  let resumeState: HarnessAgentResumeSessionState;
  {
    const agent = new HarnessAgent({ harness: openCode, sandbox });
    const session = await agent.createSession();
    sessionId = session.sessionId;
    resumeState = await session.stop();
  }

  {
    const agent = new HarnessAgent({ harness: openCode, sandbox });
    const session = await agent.createSession({
      sessionId,
      resumeFrom: resumeState,
    });
    if (!session.isResume) {
      throw new Error('expected resumed session');
    }
    await session.destroy();
  }

  console.log('Successfully resumed the named Vercel Sandbox session.');
  process.exitCode = 0;
});
