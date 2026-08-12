import { google, type GoogleSpeechModelOptions } from '@ai-sdk/google';
import { generateSpeech } from 'ai';
import { saveAudioFile } from '../../lib/save-audio';
import { run } from '../../lib/run';

run(async () => {
  // Multi-speaker dialogue is configured through provider options and overrides
  // the top-level `voice`. Each speaker name must appear in the input text.
  const result = await generateSpeech({
    model: google.speech('gemini-2.5-flash-preview-tts'),
    text: 'Joe: How is it going today, Jane?\nJane: Not too bad, looking forward to the weekend!',
    providerOptions: {
      google: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            {
              speaker: 'Joe',
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            {
              speaker: 'Jane',
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
            },
          ],
        },
      } satisfies GoogleSpeechModelOptions,
    },
  });

  console.log('Audio:', result.audio);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
  console.log('Provider Metadata:', result.providerMetadata);

  await saveAudioFile(result.audio);
});
