import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
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
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
