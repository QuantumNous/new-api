import { xai, type XaiTranscriptionModelOptions } from '@ai-sdk/xai';
import { transcribe } from 'ai';
import { readFile } from 'fs/promises';
import { run } from '../../lib/run';

run(async () => {
  const result = await transcribe({
    model: xai.transcription(),
    audio: Buffer.from(await readFile('./data/galileo.mp3')).toString('base64'),
    providerOptions: {
      xai: {
        language: 'en',
        format: true,
        keyterm: ['Galileo', 'Jupiter'],
      } satisfies XaiTranscriptionModelOptions,
    },
  });

  console.log('Text:', result.text);
  console.log('Duration:', result.durationInSeconds);
  console.log('Language:', result.language);
  console.log('Segments:', result.segments);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
});
