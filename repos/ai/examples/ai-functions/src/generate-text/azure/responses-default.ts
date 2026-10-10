import { createAzure } from '@ai-sdk/azure';
import { generateText } from 'ai';
import { run } from '../../lib/run';

const azureDefault = createAzure({
  fetch: async (input, init) => {
    console.log('Azure  request URL:', input);
    return fetch(input, init);
  },
});

run(async () => {
  const result = await generateText({
    model: azureDefault('gpt-5-nano'),
    prompt: 'Write a short poem about the sea.',
  });

  console.log(result.text);
});
