import { groq, type GroqTranscriptionModelOptions } from '@ai-sdk/groq';
import { transcribe } from 'ai';
import { readFile } from 'fs/promises';
import { run } from '../../lib/run';

run(async () => {
  const result = await transcribe({
    model: groq.transcription('whisper-large-v3-turbo'),
    audio: Buffer.from(await readFile('./data/galileo.mp3')).toString('base64'),
    providerOptions: {
      groq: {
        responseFormat: 'verbose_json',
      } satisfies GroqTranscriptionModelOptions,
    },
  });

  console.log('Text:', result.text);
  console.log('Duration:', result.durationInSeconds);
  console.log('Language:', result.language);
  console.log('Segments:', result.segments);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
});
