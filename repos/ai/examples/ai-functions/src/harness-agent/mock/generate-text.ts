import { anthropic } from '@ai-sdk/anthropic';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createJustBashSandbox } from '@ai-sdk/sandbox-just-bash';
import { run } from '../../lib/run';
import { mockHarness } from './mock-harness';

run(async () => {
  const agent = new HarnessAgent({
    harness: mockHarness({ model: anthropic('claude-opus-4-7') }),
    sandbox: createJustBashSandbox(),
  });

  const session = await agent.createSession();
  try {
    const result = await agent.generate({
      session,
      prompt: 'In one sentence, what is the capital of France?',
    });
    console.log('text:', result.text);
    console.log('finishReason:', result.finishReason);
    console.log('usage:', result.usage);
  } finally {
    await session.destroy();
  }
});
