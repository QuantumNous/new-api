import { mistral } from '@ai-sdk/mistral';
import { generateSpeech } from 'ai';
import { saveAudioFile } from '../../lib/save-audio';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateSpeech({
    model: mistral.speech('voxtral-mini-tts-2603'),
    text: 'Hello from the AI SDK!',
    voice: 'en_paul_neutral',
  });

  console.log('Audio:', result.audio);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);

  await saveAudioFile(result.audio);
});
