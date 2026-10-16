import { huggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: huggingFace('meta-llama/Llama-3.1-8B-Instruct'),
    messages: [
      {
        role: 'user',
        content: 'Hello, I need help planning a trip to Japan.',
      },
      {
        role: 'assistant',
        content:
          'I would be happy to help you plan your trip to Japan! What time of year are you thinking of visiting, and what are you most interested in experiencing?',
      },
      {
        role: 'user',
        content:
          'I want to visit in spring to see cherry blossoms. What cities should I visit?',
      },
    ],
  });

  console.log(result.text);
  console.log();
  console.log('Usage:', result.usage);
});
