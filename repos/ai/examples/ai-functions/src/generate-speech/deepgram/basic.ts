import { deepgram } from '@ai-sdk/deepgram';
import { generateSpeech } from 'ai';
import { saveAudioFile } from '../../lib/save-audio';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateSpeech({
    model: deepgram.speech('aura-2-helena-en'),
    text: 'Hello, welcome to Deepgram! This is a test of the text-to-speech API.',
  });

  console.log('Audio:', result.audio);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
  console.log('Provider Metadata:', result.providerMetadata);

  await saveAudioFile(result.audio);
});
