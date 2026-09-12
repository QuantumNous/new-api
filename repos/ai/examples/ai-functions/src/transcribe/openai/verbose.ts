import { openai, type OpenAITranscriptionModelOptions } from '@ai-sdk/openai';
import { transcribe } from 'ai';
import { readFile } from 'fs/promises';
import { run } from '../../lib/run';

run(async () => {
  const result = await transcribe({
    model: openai.transcription('whisper-1'),
    audio: await readFile('data/galileo.mp3'),
    providerOptions: {
      openai: {
        //timestampGranularities: ['word'],
        timestampGranularities: ['segment'],
      } satisfies OpenAITranscriptionModelOptions,
    },
  });

  console.log('Text:', result.text);
  console.log('Duration:', result.durationInSeconds);
  console.log('Language:', result.language);
  console.log('Word-level segments:', result.segments);
  console.log('Warnings:', result.warnings);
});
