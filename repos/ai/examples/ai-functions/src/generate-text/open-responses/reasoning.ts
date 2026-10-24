import { createOpenResponses } from '@ai-sdk/open-responses';
import { generateText } from 'ai';
import { run } from '../../lib/run';

const lmstudio = createOpenResponses({
  name: 'lmstudio',
  url: 'https://api.openai.com/v1/responses',
  apiKey: process.env.OPENAI_API_KEY,
});

run(async () => {
  const result = await generateText({
    model: lmstudio('gpt-5'),
    prompt: 'Invent a new holiday and describe its traditions.',
    reasoning: 'high',
    maxOutputTokens: 100,
    providerOptions: {
      lmstudio: {
        reasoningSummary: 'detailed',
      },
    },
  });

  console.log(JSON.stringify(result.response.body, null, 2));

  console.log('Reasoning:', result.reasoning);
  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log('Request:', JSON.stringify(result.request, null, 2));
});
