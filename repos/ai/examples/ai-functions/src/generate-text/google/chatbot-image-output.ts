import { google, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import { generateText, type ModelMessage } from 'ai';
import * as readline from 'node:readline/promises';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages: ModelMessage[] = [];

run(async () => {
  while (true) {
    messages.push({ role: 'user', content: await terminal.question('You: ') });

    const result = await generateText({
      model: google('gemini-2.5-flash-image'),
      providerOptions: {
        google: {
          responseModalities: ['TEXT', 'IMAGE'],
        } satisfies GoogleLanguageModelOptions,
      },
      messages,
    });

    if (result.text) {
      process.stdout.write(`\nAssistant: ${result.text}`);
    }

    for (const file of result.files) {
      if (file.mediaType.startsWith('image/')) {
        await presentImages([file]);
      }
    }

    process.stdout.write('\n\n');

    messages.push(...result.responseMessages);
  }
});
