import { groq } from '@ai-sdk/groq';
import { transcribe } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await transcribe({
    model: groq.transcription('whisper-large-v3-turbo'),
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
