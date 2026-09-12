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
    console.log('--- turn 1 ---');
    const first = await agent.generate({
      session,
      prompt: 'My name is Felix. Remember it.',
    });
    console.log(first.text);

    console.log('--- turn 2 ---');
    const second = await agent.generate({
      session,
      prompt: 'What is my name? Answer in one word.',
    });
    console.log(second.text);
  } finally {
    await session.destroy();
  }
});
