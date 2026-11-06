import { googleVertex } from '@ai-sdk/google-vertex';
import { transcribe } from 'ai';
import { readFile } from 'fs/promises';
import { run } from '../../lib/run';

run(async () => {
  const result = await transcribe({
    // Chirp uses Cloud Speech-to-Text regions: set GOOGLE_VERTEX_LOCATION to a
    // Speech region (e.g. `us-central1`) or pass `providerOptions.googleVertex.region`.
    model: googleVertex.transcription('chirp_2'),
    audio: await readFile('data/galileo.mp3'),
  });

  console.log('Text:', result.text);
  console.log('Duration:', result.durationInSeconds);
  console.log('Language:', result.language);
  console.log('Segments:', result.segments);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
});
