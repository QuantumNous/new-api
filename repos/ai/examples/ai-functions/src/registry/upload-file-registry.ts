import { openai } from '@ai-sdk/openai';
import {
  createProviderRegistry,
  customProvider,
  generateText,
  uploadFile,
} from 'ai';
import fs from 'node:fs';
import { run } from '../lib/run';

const registry = createProviderRegistry({
  openai: customProvider({
    languageModels: { 'gpt-4o-mini': openai.responses('gpt-4o-mini') },
    files: openai.files(),
  }),
});

run(async () => {
  const { providerReference, mediaType, filename } = await uploadFile({
    api: registry.files('openai'),
    data: fs.readFileSync('./data/comic-cat.png'),
    filename: 'comic-cat.png',
  });

  console.log('Provider reference:', providerReference);
  console.log('Media type:', mediaType);
  console.log('Filename:', filename);

  const result = await generateText({
    model: registry.languageModel('openai:gpt-4o-mini'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe what you see in this image.' },
          { type: 'file', mediaType: 'image', data: providerReference },
        ],
      },
    ],
  });

  console.log(result.text);
});
