import { google, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import { streamText } from 'ai';
import { presentImages } from '../../lib/present-image';
import { run } from '../../lib/run';

const providerOptions = {
  google: {
    responseModalities: ['TEXT', 'IMAGE'],
    thinkingConfig: {
      includeThoughts: true,
    },
  } satisfies GoogleLanguageModelOptions,
};

run(async () => {
  console.log('=== STEP 1 ===');
  const step1 = streamText({
    model: google('gemini-3-pro-image-preview'),
    prompt: 'Generate a cartoon of a soccer stadium on the moon.',
    providerOptions,
  });

  for await (const part of step1.stream) {
    switch (part.type) {
      case 'reasoning-delta': {
        process.stdout.write('\x1b[34m' + part.text + '\x1b[0m');
        break;
      }
      case 'text-delta': {
        process.stdout.write(part.text);
        break;
      }
      case 'reasoning-file': {
        if (part.file.mediaType.startsWith('image/')) {
          console.log('Reasoning image');
        }
        break;
      }
      case 'file': {
        if (part.file.mediaType.startsWith('image/')) {
          await presentImages([part.file]);
        }
        break;
      }
    }
  }
  console.log();

  console.log('=== STEP 2 ===');
  const step2 = streamText({
    model: google('gemini-3-pro-image-preview'),
    messages: [
      ...(await step1.response).messages,
      {
        role: 'user',
        content: "Change it so that it's on Saturn.",
      },
    ],
    providerOptions,
  });

  for await (const part of step2.stream) {
    switch (part.type) {
      case 'reasoning-delta': {
        process.stdout.write('\x1b[34m' + part.text + '\x1b[0m');
        break;
      }
      case 'text-delta': {
        process.stdout.write(part.text);
        break;
      }
      case 'reasoning-file': {
        if (part.file.mediaType.startsWith('image/')) {
          console.log('Reasoning image');
        }
        break;
      }
      case 'file': {
        if (part.file.mediaType.startsWith('image/')) {
          await presentImages([part.file]);
        }
        break;
      }
    }
  }
  console.log();
});
