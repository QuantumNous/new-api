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
    const result = await agent.stream({
      session,
      prompt: 'Recite the first sentence of "A Tale of Two Cities".',
    });

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') process.stdout.write(part.text);
    }
    console.log();

    console.log('finishReason:', await result.finishReason);
    console.log('usage:', await result.usage);
    console.log('steps:', (await result.steps).length);
  } finally {
    await session.destroy();
  }
});
