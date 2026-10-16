import {
  elevenLabs,
  type ElevenLabsSpeechModelOptions,
} from '@ai-sdk/elevenlabs';
import { generateSpeech } from 'ai';
import { saveAudioFile } from '../../lib/save-audio';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateSpeech({
    model: elevenLabs.speech('eleven_multilingual_v2'),
    text: 'This speech has custom voice settings for more expressive output.',
    speed: 1.2,
    providerOptions: {
      elevenlabs: {
        voiceSettings: {
          stability: 0.3, // Lower for more variation
          similarityBoost: 0.8, // Higher for closer to original voice
          style: 0.6, // Control speaking style
          useSpeakerBoost: true, // Enhance voice clarity
        },
      } satisfies ElevenLabsSpeechModelOptions,
    },
  });

  console.log('Audio:', result.audio);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
  console.log('Provider Metadata:', result.providerMetadata);

  await saveAudioFile(result.audio);
});
