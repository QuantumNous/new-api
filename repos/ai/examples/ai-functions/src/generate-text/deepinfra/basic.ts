import { deepInfra } from '@ai-sdk/deepinfra';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { text, usage } = await generateText({
    model: deepInfra('mistralai/Mixtral-8x7B-Instruct-v0.1'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(text);
  console.log();
  console.log('Usage:', usage);
});
