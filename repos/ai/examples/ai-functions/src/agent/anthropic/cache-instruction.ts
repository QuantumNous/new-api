import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { ToolLoopAgent } from 'ai';
import fs from 'node:fs';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

const errorMessage = fs.readFileSync('data/error-message.txt', 'utf8');

const agent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4-5'),
  instructions: [
    {
      role: 'system',
      content: `You are a JavaScript expert that knows everything about the following error message: ${errorMessage}`,
      providerOptions: {
        anthropic: {
          cacheControl: { type: 'ephemeral', ttl: '1h' },
        } satisfies AnthropicLanguageModelOptions,
      },
    },
    {
      role: 'system',
      content: 'You pay special attention to the error message.',
    },
  ],
});

run(async () => {
  const result = await agent.generate({
    prompt: 'Explain the error message.',
  });

  print('Result:', result.content);
  print('Metadata:', result.providerMetadata?.anthropic);
  print('Request:', result.request.body);
});
