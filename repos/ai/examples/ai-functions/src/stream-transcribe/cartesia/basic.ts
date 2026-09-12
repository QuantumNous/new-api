import { cartesia } from '@ai-sdk/cartesia';
import { openai } from '@ai-sdk/openai';
import {
  experimental_streamTranscribe as streamTranscribe,
  generateSpeech,
} from 'ai';
import { setTimeout as delay } from 'node:timers/promises';
import { run } from '../../lib/run';

run(async () => {
  // Generate raw PCM audio (24kHz, 16-bit, mono) to transcribe.
  const speech = await generateSpeech({
    model: openai.speech('tts-1'),
    text: 'Hello from the AI SDK! Streaming transcription is experimental.',
    outputFormat: 'pcm',
  });

  // Stream the raw audio in chunks, as a microphone would.
  const bytes = speech.audio.uint8Array;
  // Cartesia's realtime endpoint expects audio at approximately playback rate.
  // At 24kHz, 16-bit mono PCM, 4,800 bytes represents 100ms of audio.
  const chunkSize = 4800;
  let offset = 0;
  const audio = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }

      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
      if (offset < bytes.length) {
        await delay(100);
      }
    },
  });

  const result = streamTranscribe({
    model: cartesia.transcription('ink-2'),
    audio,
    inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
  });

  for await (const part of result.fullStream) {
    if (part.type === 'transcript-partial') {
      console.log('partial:', part.text);
    }

    if (part.type === 'transcript-final') {
      console.log('final:', part.text);
    }
  }

  console.log('Text:', await result.text);
  console.log('Duration:', await result.durationInSeconds);
  console.log('Warnings:', await result.warnings);
});
