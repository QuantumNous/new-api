type HumeSpeechAPIUtterances = Array<{
  text: string;
  description?: string;
  speed?: number;
  trailing_silence?: number;
  voice?:
    | {
        id: string;
        provider?: 'HUME_AI' | 'CUSTOM_VOICE';
      }
    | {
        name: string;
        provider?: 'HUME_AI' | 'CUSTOM_VOICE';
      };
}>;

export type HumeSpeechAPITypes = {
  utterances: HumeSpeechAPIUtterances;
  context?:
    | {
        generation_id: string;
      }
    | {
        utterances: HumeSpeechAPIUtterances;
      };
  format: {
    type: 'mp3' | 'pcm' | 'wav';
  };
};
