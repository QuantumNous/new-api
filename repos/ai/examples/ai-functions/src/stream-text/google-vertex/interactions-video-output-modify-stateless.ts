import { type GoogleLanguageModelInteractionsOptions } from '@ai-sdk/google';
import { createGoogleVertex } from '@ai-sdk/google-vertex';
import { streamText, type GeneratedFile, type ModelMessage } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

// `gemini-omni-flash-preview` is served by the Interactions API. On Vertex the
// model is currently only available in the `global` region, so pin the location
// explicitly rather than relying on `GOOGLE_VERTEX_LOCATION`. Uses standard
// Google Cloud credentials (not Express Mode API keys).
const vertex = createGoogleVertex({ location: 'global' });
const model = vertex.interactions('gemini-omni-flash-preview');

run(async () => {
  const messages: Array<ModelMessage> = [
    {
      role: 'user',
      content:
        'A marble rolling fast on a chain reaction style track, continuous smooth shot.',
    },
  ];

  console.log('--- Turn 1: generate ---');
  const turn1Videos: Array<GeneratedFile> = [];

  const turn1 = streamText({
    model,
    messages,
    providerOptions: {
      google: {
        store: false,
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  await withSpinner('Generating video...', async () => {
    for await (const part of turn1.stream) {
      switch (part.type) {
        case 'text-delta': {
          process.stdout.write(part.text);
          break;
        }
        case 'file': {
          if (part.file.mediaType.startsWith('video/')) {
            turn1Videos.push(part.file);
          }
          break;
        }
      }
    }
  });

  console.log();
  console.log(
    'Turn 1 interaction id:',
    (await turn1.providerMetadata)?.google?.interactionId,
  );

  if (turn1Videos.length > 0) {
    await presentVideos(turn1Videos);
  }

  messages.push(...(await turn1.response).messages);
  messages.push({
    role: 'user',
    content: 'Make the marble blue.',
  });

  console.log();
  console.log('--- Turn 2: modify (make the marble blue) ---');
  const turn2Videos: Array<GeneratedFile> = [];

  const turn2 = streamText({
    model,
    messages,
    providerOptions: {
      google: {
        store: false,
      } satisfies GoogleLanguageModelInteractionsOptions,
    },
  });

  await withSpinner('Modifying video...', async () => {
    for await (const part of turn2.stream) {
      switch (part.type) {
        case 'text-delta': {
          process.stdout.write(part.text);
          break;
        }
        case 'file': {
          if (part.file.mediaType.startsWith('video/')) {
            turn2Videos.push(part.file);
          }
          break;
        }
      }
    }
  });

  console.log();
  console.log(
    'Turn 2 interaction id:',
    (await turn2.providerMetadata)?.google?.interactionId,
  );

  if (turn2Videos.length > 0) {
    await presentVideos(turn2Videos);
  }
});
