import { xai } from '@ai-sdk/xai';
import { generateSpeech } from 'ai';
import { saveAudioFile } from '../../lib/save-audio';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateSpeech({
    model: xai.speech(),
    text: 'Wait for it. [pause] <whisper>This is synthesized by xAI.</whisper> [laugh]',
    voice: 'eve',
    language: 'en',
  });

  console.log('Audio:', result.audio);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);

  await saveAudioFile(result.audio);
});
