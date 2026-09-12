import { HarnessAgent } from '@ai-sdk/harness/agent';
import { codex } from '@ai-sdk/harness-codex';
import { run } from '../../lib/run';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';

run(async () => {
  const sandbox = createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
    timeout: 10 * 60 * 1000,
  });

  try {
    new HarnessAgent({
      harness: codex,
      sandbox,
      permissionMode: 'allow-edits',
    });
    throw new Error('Expected Codex built-in tool approval to be unsupported.');
  } catch (err) {
    console.log('[example] expected unsupported built-in approval:', err);
  }
});
