import { createAnthropicAws } from '@ai-sdk/anthropic-aws';
import { generateText } from 'ai';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

// API-key auth path. Set in .env or shell:
//   AWS_REGION=us-east-2
//   ANTHROPIC_AWS_WORKSPACE_ID=wrkspc_…
//   ANTHROPIC_AWS_API_KEY=sk-…
const anthropicAws = createAnthropicAws();

run(async () => {
  const result = await generateText({
    model: anthropicAws('claude-sonnet-4-6'),
    prompt: 'Invent a new holiday and describe its traditions.',
    maxRetries: 0,
  });

  print('Content:', result.content);
  print('Usage:', result.usage);
  print('Finish reason:', result.finishReason);
});
