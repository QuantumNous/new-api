import { openai } from '@ai-sdk/openai';
import {
  experimental_streamTranscribe as streamTranscribe,
  generateSpeech,
} from 'ai';
import { run } from '../../lib/run';

run(async () => {
  // generate raw PCM audio (24kHz, 16-bit, mono) to transcribe:
  const speech = await generateSpeech({
    model: openai.speech('tts-1'),
    text: 'Hello from the AI SDK! Streaming transcription is experimental.',
    outputFormat: 'pcm',
  });

  // stream the raw audio in chunks, as a microphone would:
  const bytes = speech.audio.uint8Array;
  const chunkSize = 16 * 1024;
  const audio = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize));
      }
      controller.close();
    },
  });

  const result = streamTranscribe({
    model: openai.transcription('gpt-realtime-whisper'),
    audio,
    inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    providerOptions: {
      openai: {
        streaming: { delay: 'low' },
      },
    },
  });

  for await (const part of result.fullStream) {
    if (part.type === 'transcript-delta') {
      process.stdout.write(part.delta);
    }
  }
  console.log();

  console.log('Text:', await result.text);
  console.log('Language:', await result.language);
  console.log('Duration:', await result.durationInSeconds);
  console.log('Warnings:', await result.warnings);
  console.log('Responses:', await result.responses);
});
