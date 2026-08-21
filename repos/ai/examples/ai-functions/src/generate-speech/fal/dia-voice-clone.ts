import { fal, type FalSpeechModelOptions } from '@ai-sdk/fal';
import { generateSpeech } from 'ai';
import { saveAudioFile } from '../../lib/save-audio';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateSpeech({
    model: fal.speech('fal-ai/dia-tts/voice-clone'),
    text: "[S1] Hello, how are you? [S2] I'm good, thank you. [S1] What's your name? [S2] My name is Dia. [S1] Nice to meet you. [S2] Nice to meet you too.",
    providerOptions: {
      fal: {
        ref_audio_url:
          'https://v3.fal.media/files/elephant/d5lORit2npFfBykcAtyUr_tmplacfh8oa.mp3',
        ref_text:
          '[S1] Dia is an open weights text to dialogue model. [S2] You get full control over scripts and voices.',
      } satisfies FalSpeechModelOptions,
    },
  });

  console.log('Audio:', result.audio);
  console.log('Warnings:', result.warnings);
  console.log('Responses:', result.responses);
  console.log('Provider Metadata:', result.providerMetadata);

  await saveAudioFile(result.audio);
});
