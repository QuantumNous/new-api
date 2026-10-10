import { groq, type GroqTranscriptionModelOptions } from '@ai-sdk/groq';
import { transcribe } from 'ai';
import 'dotenv/config';
import { readFile } from 'fs/promises';
import path from 'path';

async function main() {
  const result = await transcribe({
    model: groq.transcription('whisper-large-v3-turbo'),
    audio: await readFile(path.join(__dirname, '../../data/galileo.mp3')),
    providerOptions: {
      groq: {
        language: 'en',
        timestampGranularities: ['word', 'segment'],
        responseFormat: 'verbose_json', // this is required for timestamp granularities
      } satisfies GroqTranscriptionModelOptions,
    },
  });

  console.log('Text:', result.text);
  console.log('Duration:', result.durationInSeconds);
  console.log('Language:', result.language);
  console.log('Segments:', result.segments);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
}

main().catch(console.error);
