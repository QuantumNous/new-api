import { cartesia } from '@ai-sdk/cartesia';
import { generateSpeech } from 'ai';
import { saveAudioFile } from '../../lib/save-audio';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateSpeech({
    model: cartesia.speech('sonic-3.5'),
    text: 'Hello, welcome to Cartesia! This is a test of the text-to-speech API.',
    voice: 'a0e99841-438c-4a64-b679-ae501e7d6091',
  });

  console.log('Audio:', result.audio);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
  console.log('Provider Metadata:', result.providerMetadata);

  await saveAudioFile(result.audio);
});
