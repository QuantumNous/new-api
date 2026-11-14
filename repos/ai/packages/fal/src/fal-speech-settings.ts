// https://fal.ai/explore/search?categories=text-to-speech&q=newest
export type FalSpeechModelId =
  | 'fal-ai/minimax/voice-clone'
  | 'fal-ai/minimax/voice-design'
  | 'fal-ai/dia-tts/voice-clone'
  | 'fal-ai/minimax/speech-02-hd'
  | 'fal-ai/minimax/speech-02-turbo'
  | 'fal-ai/dia-tts'
  | 'resemble-ai/chatterboxhd/text-to-speech'
  | (string & {});
