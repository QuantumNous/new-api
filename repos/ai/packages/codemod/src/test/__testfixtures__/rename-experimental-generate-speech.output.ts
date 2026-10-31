import {
  generateSpeech,
  type SpeechResult,
} from 'ai';

declare const speechModel: any;

export const result: SpeechResult =
  await generateSpeech({
    model: speechModel,
    text: 'Hello',
  });
