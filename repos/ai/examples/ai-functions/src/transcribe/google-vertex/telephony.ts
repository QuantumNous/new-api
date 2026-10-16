import {
  googleVertex,
  type GoogleVertexTranscriptionModelOptions,
} from '@ai-sdk/google-vertex';
import { transcribe } from 'ai';
import { readFile } from 'fs/promises';
import { run } from '../../lib/run';

run(async () => {
  const result = await transcribe({
    model: googleVertex.transcription('telephony'),
    audio: await readFile('data/galileo.mp3'),
    providerOptions: {
      googleVertex: {
        languageCodes: ['en-US'],
      } satisfies GoogleVertexTranscriptionModelOptions,
    },
  });

  console.log('Text:', result.text);
  console.log('Duration:', result.durationInSeconds);
  console.log('Language:', result.language);
  console.log('Segments:', result.segments);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
});
