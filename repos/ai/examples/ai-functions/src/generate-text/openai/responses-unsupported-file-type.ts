import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai.responses('gpt-4.1-nano'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What names appear in this CSV? Reply with just the names.',
          },
          {
            type: 'file',
            filename: 'names.csv',
            mediaType: 'text/csv',
            data: Buffer.from('name,role\nAda,engineer\nGrace,scientist\n'),
          },
        ],
      },
    ],
    providerOptions: {
      openai: {
        passThroughUnsupportedFiles: true,
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  console.log(result.text);
});
