import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { HarnessAgent } from '@ai-sdk/harness/agent';
import { createJustBashSandbox } from '@ai-sdk/sandbox-just-bash';
import { run } from '../../lib/run';
import { mockHarness } from './mock-harness';

run(async () => {
  const agent = new HarnessAgent({
    harness: mockHarness({
      model: anthropic('claude-opus-4-7'),
      providerOptions: {
        anthropic: {
          thinking: { type: 'adaptive', display: 'summarized' },
        } satisfies AnthropicLanguageModelOptions,
      },
    }),
    sandbox: createJustBashSandbox(),
  });

  const session = await agent.createSession();
  try {
    const result = await agent.stream({
      session,
      prompt:
        'Find all roots of f(x) = x^3 - 6x^2 + 11x - 6 and explain your reasoning.',
    });

    for await (const part of result.fullStream) {
      if (part.type === 'reasoning-delta') {
        process.stdout.write('\x1b[34m' + part.text + '\x1b[0m');
      } else if (part.type === 'text-delta') {
        process.stdout.write(part.text);
      }
    }
    console.log();
    console.log('usage:', await result.usage);
  } finally {
    await session.destroy();
  }
});
