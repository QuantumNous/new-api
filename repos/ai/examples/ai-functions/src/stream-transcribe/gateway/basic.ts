import {
  experimental_streamTranscribe as streamTranscribe,
  generateSpeech,
} from 'ai';
import { run } from '../../lib/run';

// String model IDs resolve through the global provider (AI Gateway by
// default). Gateway WebSocket auth is carried in the subprotocols, so the
// native WebSocket works — no header-capable implementation needed.
run(async () => {
  // generate raw PCM audio (24kHz, 16-bit, mono) to transcribe:
  const speech = await generateSpeech({
    model: 'openai/tts-1',
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
    model: 'openai/gpt-realtime-whisper',
    audio,
    inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
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
