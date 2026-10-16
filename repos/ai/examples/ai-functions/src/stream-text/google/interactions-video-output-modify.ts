import {
  google,
  type GoogleLanguageModelInteractionsOptions,
} from '@ai-sdk/google';
import { streamText, type GeneratedFile } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const model = google.interactions('gemini-omni-flash-preview');

  console.log('--- Turn 1: generate ---');
  const turn1Videos: Array<GeneratedFile> = [];
  const turn1InteractionId = await withSpinner(
    'Generating video (turn 1)...',
    async () => {
      const turn1 = streamText({
        model,
        prompt:
          'A red marble rolling fast on a chain reaction style track, continuous smooth shot.',
        providerOptions: {
          google: {
            responseModalities: ['video'],
          } satisfies GoogleLanguageModelInteractionsOptions,
        },
      });

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

      console.log();
      const interactionId = (await turn1.providerMetadata)?.google
        ?.interactionId as string | undefined;
      console.log('Turn 1 interaction id:', interactionId);
      return interactionId;
    },
  );

  if (turn1Videos.length > 0) {
    await presentVideos(turn1Videos);
  }

  if (turn1InteractionId == null) {
    throw new Error(
      'No interactionId returned from turn 1; cannot chain a modify turn.',
    );
  }

  console.log();
  console.log('--- Turn 2: modify (now make the marble blue) ---');
  const turn2Videos: Array<GeneratedFile> = [];
  await withSpinner('Generating video (turn 2)...', async () => {
    const turn2 = streamText({
      model,
      prompt: 'now make the marble blue',
      providerOptions: {
        google: {
          responseModalities: ['video'],
          previousInteractionId: turn1InteractionId,
        } satisfies GoogleLanguageModelInteractionsOptions,
      },
    });

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

    console.log();
    console.log(
      'Turn 2 interaction id:',
      (await turn2.providerMetadata)?.google?.interactionId,
    );
  });

  if (turn2Videos.length > 0) {
    await presentVideos(turn2Videos);
  }
});
