import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const resourceName = process.env.ANTHROPIC_MICROSOFT_RESOURCE_NAME;
  const apiKey = process.env.ANTHROPIC_MICROSOFT_API_KEY;
  if (!resourceName || !apiKey) {
    throw new Error('undeinfed resource or key.');
  }

  const anthropic = createAnthropic({
    baseURL: `https://${resourceName}.services.ai.azure.com/anthropic/v1/`,
    apiKey,
  });

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
