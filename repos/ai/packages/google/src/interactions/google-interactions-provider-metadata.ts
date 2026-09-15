/**
 * Provider-metadata shape that the Gemini Interactions language model writes
 * onto `result.providerMetadata.google` (and reads back from input messages on
 * the next turn for stateful chaining and signature round-trip).
 */
export type GoogleInteractionsProviderMetadata = {
  /**
   * Gemini-server-side interaction id (`Interaction.id`). Pass back in
   * `providerOptions.google.previousInteractionId` to chain stateful turns.
   */
  interactionId?: string;

  /**
   * Service tier used for this interaction (passthrough for observability).
   */
  serviceTier?: string;

  /**
   * Output token counts keyed by modality (e.g. `{ video: 57920 }`), sourced
   * from the Interactions API `output_tokens_by_modality`. Present only when
   * the response reports a breakdown. Preview surface for per-modality billing;
   * may be promoted to a first-class usage field later.
   */
  outputTokensByModality?: Record<string, number>;

  /**
   * Per-block signature hash for backend validation. Set by the SDK on output
   * reasoning / tool-call parts and round-tripped on input parts.
   */
  signature?: string;
};
