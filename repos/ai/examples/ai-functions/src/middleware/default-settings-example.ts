import { openai } from '@ai-sdk/openai';
import { defaultSettingsMiddleware, generateText, wrapLanguageModel } from 'ai';
import { run } from '../lib/run';

run(async () => {
  const result = await generateText({
    model: wrapLanguageModel({
      model: openai.responses('gpt-4o'),
      middleware: defaultSettingsMiddleware({
        settings: {
          temperature: 0.5,
          providerOptions: {
            openai: {
              store: false,
            },
          },
        },
      }),
    }),
    prompt: 'What cities are in the United States?',
  });

  console.log(result.response.body);
});
