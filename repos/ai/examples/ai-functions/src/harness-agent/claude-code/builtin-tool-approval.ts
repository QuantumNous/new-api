import { HarnessAgent } from '@ai-sdk/harness/agent';
import { claudeCode } from '@ai-sdk/harness-claude-code';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';
import {
  createToolApprovalResponseMessages,
  printFullStreamAndCaptureToolApproval,
} from '../../lib/harness-tool-approval';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';

run(async () => {
  const sandbox = createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
    timeout: 10 * 60 * 1000,
  });
  const agent = new HarnessAgent({
    harness: claudeCode,
    sandbox,
    permissionMode: 'allow-edits',
  });

  let exitCode = 0;
  const session = await agent.createSession();
  try {
    const first = await agent.stream({
      session,
      prompt: 'Run `pwd` with Bash and tell me the working directory.',
    });
    const approval = await printFullStreamAndCaptureToolApproval({
      result: first,
    });
    if (approval == null) {
      throw new Error('Expected a built-in Bash tool approval request.');
    }

    const second = await agent.stream({
      session,
      messages: createToolApprovalResponseMessages({
        approval,
        approved: true,
      }),
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
