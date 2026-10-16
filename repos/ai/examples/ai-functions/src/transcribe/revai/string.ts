import { revai } from '@ai-sdk/revai';
import { transcribe } from 'ai';
import { readFile } from 'fs/promises';
import { run } from '../../lib/run';

run(async () => {
  const result = await transcribe({
    model: revai.transcription('machine'),
    audio: Buffer.from(await readFile('./data/galileo.mp3')).toString('base64'),
  });

  console.log('Text:', result.text);
  console.log('Duration:', result.durationInSeconds);
  console.log('Language:', result.language);
  console.log('Segments:', result.segments);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
  console.log('Provider Metadata:', result.providerMetadata);
});
