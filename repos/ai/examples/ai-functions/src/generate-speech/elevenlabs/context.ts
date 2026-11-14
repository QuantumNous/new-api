import { elevenLabs } from '@ai-sdk/elevenlabs';
import { generateSpeech } from 'ai';
import { saveAudioFile } from '../../lib/save-audio';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateSpeech({
    model: elevenLabs.speech('eleven_multilingual_v2'),
    text: 'This sentence uses context for better prosody.',
    providerOptions: {
      elevenlabs: {
        previous_text: 'The previous sentence ended with a question mark?',
        next_text: 'The next sentence will continue the story.',
        seed: 42, // For reproducible generation
      },
    },
  });

  console.log('Audio:', result.audio);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
  console.log('Provider Metadata:', result.providerMetadata);
  console.log('Used context for improved prosody and consistency');

  await saveAudioFile(result.audio);
});
