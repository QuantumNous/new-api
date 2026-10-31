import { createAzure } from '@ai-sdk/azure';
import { transcribe } from 'ai';
import { readFile } from 'fs/promises';
import { run } from '../../lib/run';

run(async () => {
  const azure = createAzure({
    useDeploymentBasedUrls: true,
    apiVersion: '2025-04-01-preview',
  });

  const result = await transcribe({
    model: azure.transcription('whisper-1'),
    audio: await readFile('data/galileo.mp3'),
  });

  console.log('Text:', result.text);
  console.log('Duration:', result.durationInSeconds);
  console.log('Language:', result.language);
  console.log('Segments:', result.segments);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
});
