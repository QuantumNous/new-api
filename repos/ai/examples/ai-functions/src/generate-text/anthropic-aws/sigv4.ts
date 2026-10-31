import { createAnthropicAws } from '@ai-sdk/anthropic-aws';
import { generateText } from 'ai';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

// SigV4 auth path. Picks up AWS credentials from the default chain:
//   AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (+ optional AWS_SESSION_TOKEN)
// or any other source the AWS SDK normally resolves.
//
// Required env vars:
//   AWS_REGION=us-east-2
//   ANTHROPIC_AWS_WORKSPACE_ID=wrkspc_…
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
