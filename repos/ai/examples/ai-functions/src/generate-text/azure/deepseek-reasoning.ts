import { createAzure } from '@ai-sdk/azure';
import { generateText } from 'ai';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

const azure = createAzure({
  baseURL: process.env.AZURE_BASE_URL,
});

run(async () => {
  const result = await generateText({
    model: azure.deepseek('deepseek-v4-pro'),
    prompt:
      'Can you please invent a new holiday around the latest Knicks game?',
    reasoning: 'high',
    include: {
      responseBody: true,
    },
  });

  print('Reasoning:', result.reasoningText);
  print('Text:', result.text);

  return result;
});
