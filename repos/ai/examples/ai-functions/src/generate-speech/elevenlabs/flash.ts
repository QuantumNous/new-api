import { elevenLabs } from '@ai-sdk/elevenlabs';
import { generateSpeech } from 'ai';
import { saveAudioFile } from '../../lib/save-audio';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateSpeech({
    model: elevenLabs.speech('eleven_flash_v2_5'),
    text: 'This is using the ultra-low latency Flash model for real-time applications.',
  });

  console.log('Audio:', result.audio);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
  console.log('Provider Metadata:', result.providerMetadata);
  console.log('Model used: eleven_flash_v2_5 (ultra-low latency ~75ms)');

  await saveAudioFile(result.audio);
});
