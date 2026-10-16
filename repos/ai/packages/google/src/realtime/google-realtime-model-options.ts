export type GoogleRealtimeModelId = string;

export type GoogleRealtimeModelOptions = {
  /**
   * Gemini Live Translation configuration.
   *
   * Required for `gemini-3.5-live-translate-preview` when translating speech
   * to a target language.
   */
  translationConfig?: {
    /**
     * BCP-47 language code of the language to translate into.
     * Defaults to `en` in the Gemini API.
     */
    targetLanguageCode?: string;

    /**
     * Whether input audio already in the target language should be echoed
     * instead of producing silence.
     */
    echoTargetLanguage?: boolean;
  };
};
