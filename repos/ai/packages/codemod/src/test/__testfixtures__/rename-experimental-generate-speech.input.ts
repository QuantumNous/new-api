import {
  experimental_generateSpeech,
  type Experimental_SpeechResult,
} from 'ai';

declare const speechModel: any;

export const result: Experimental_SpeechResult =
  await experimental_generateSpeech({
    model: speechModel,
    text: 'Hello',
  });
