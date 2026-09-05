import { openai } from '@ai-sdk/openai';
import {
  generateText,
  wrapLanguageModel,
  type LanguageModelMiddleware,
} from 'ai';
import { run } from '../../lib/run';

const logProviderMetadataMiddleware: LanguageModelMiddleware = {
  transformParams: async ({ params }) => {
    console.log(
      'providerOptions: ' + JSON.stringify(params.providerOptions, null, 2),
    );
    return params;
  },
};

run(async () => {
  const { text } = await generateText({
    model: wrapLanguageModel({
      model: openai('gpt-4o'),
      middleware: logProviderMetadataMiddleware,
    }),
    providerOptions: {
      myMiddleware: {
        example: 'value',
      },
    },
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(text);
});
