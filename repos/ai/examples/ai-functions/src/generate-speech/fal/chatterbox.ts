import { fal, type FalSpeechModelOptions } from '@ai-sdk/fal';
import { generateSpeech } from 'ai';
import { saveAudioFile } from '../../lib/save-audio';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateSpeech({
    model: fal.speech('resemble-ai/chatterboxhd/text-to-speech'),
    text: 'My name is Maximus Decimus Meridius, commander of the Armies of the North, General of the Felix Legions and loyal servant to the true emperor, Marcus Aurelius. Father to a murdered son, husband to a murdered wife. And I will have my vengeance, in this life or the next.',
    providerOptions: {
      fal: {
        high_quality_audio: true,
        exaggeration: 0.5,
        cfg: 0.5,
        temperature: 0.8,
        audio_url:
          'https://storage.googleapis.com/chatterbox-demo-samples/prompts/male_rickmorty.mp3',
      } satisfies FalSpeechModelOptions,
    },
  });

  console.log('Audio:', result.audio);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
  console.log('Provider Metadata:', result.providerMetadata);

  await saveAudioFile(result.audio);
});
