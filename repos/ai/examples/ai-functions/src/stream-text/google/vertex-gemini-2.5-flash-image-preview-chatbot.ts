import { googleVertex } from '@ai-sdk/google-vertex';
import { streamText, type ModelMessage } from 'ai';
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

    const result = streamText({
      model: googleVertex('gemini-2.5-flash-image'),
      messages,
    });

    process.stdout.write('\nAssistant: ');
    for await (const delta of result.stream) {
      switch (delta.type) {
        case 'text-delta': {
          process.stdout.write(delta.text);
          break;
        }

        case 'file': {
          if (delta.file.mediaType.startsWith('image/')) {
            console.log(delta.file);
            await presentImages([delta.file]);
          }
        }
      }
    }
    process.stdout.write('\n\n');

    messages.push(...(await result.response).messages);
  }
});
