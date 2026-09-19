import { assemblyai } from '@ai-sdk/assemblyai';
import { transcribe } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await transcribe({
    model: assemblyai.transcription('universal-3-5-pro'),
    audio: new URL(
      'https://github.com/vercel/ai/raw/refs/heads/main/examples/ai-functions/data/galileo.mp3',
    ),
  });

  console.log('Text:', result.text);
  console.log('Duration:', result.durationInSeconds);
  console.log('Language:', result.language);
  console.log('Segments:', result.segments);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
});
