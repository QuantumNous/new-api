import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai.chat('gpt-4o-mini'),
    messages: [
      { role: 'user', content: 'say hi' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'say hi again' },
    ],
  });

  print('Response:', result.text);
  print('Request:', result.request.body);
});
