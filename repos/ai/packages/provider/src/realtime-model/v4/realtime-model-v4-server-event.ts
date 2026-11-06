/**
 * Normalized events emitted by the realtime model (model → browser).
 * Each provider maps its native event format to this discriminated union.
 *
 * Every event includes a `raw` field with the original provider-specific
 * event data for debugging and provider-specific access.
 */
export type RealtimeModelV4ServerEvent =
  // ── Session lifecycle ──────────────────────────────────────────────

  | {
      type: 'session-created';
      sessionId?: string;
      raw: unknown;
    }
  | {
      type: 'session-updated';
      raw: unknown;
    }

  // ── Input audio buffer ─────────────────────────────────────────────
  | {
      type: 'speech-started';
      itemId?: string;
      raw: unknown;
    }
  | {
      type: 'speech-stopped';
      itemId?: string;
      raw: unknown;
    }
  | {
      type: 'audio-committed';
      itemId?: string;
      previousItemId?: string;
      raw: unknown;
    }

  // ── Conversation items ─────────────────────────────────────────────
  | {
      type: 'conversation-item-added';
      itemId: string;
      item: unknown;
      raw: unknown;
    }
  | {
      type: 'input-transcription-completed';
      itemId: string;
      transcript: string;
      raw: unknown;
    }

  // ── Response lifecycle ─────────────────────────────────────────────
  | {
      type: 'response-created';
      responseId: string;
      raw: unknown;
    }
  | {
      type: 'response-done';
      responseId: string;
      status: string;
      raw: unknown;
    }

  // ── Output item lifecycle ──────────────────────────────────────────
  | {
      type: 'output-item-added';
      responseId: string;
      itemId: string;
      raw: unknown;
    }
  | {
      type: 'output-item-done';
      responseId: string;
      itemId: string;
      raw: unknown;
    }
  | {
      type: 'content-part-added';
      responseId: string;
      itemId: string;
      raw: unknown;
    }
  | {
      type: 'content-part-done';
      responseId: string;
      itemId: string;
      raw: unknown;
    }

  // ── Audio output ───────────────────────────────────────────────────
  | {
      type: 'audio-delta';
      responseId: string;
      itemId: string;

      /**
       * Base64-encoded audio chunk.
       */
      delta: string;
      raw: unknown;
    }
  | {
      type: 'audio-done';
      responseId: string;
      itemId: string;
      raw: unknown;
    }

  // ── Audio transcript output ────────────────────────────────────────
  | {
      type: 'audio-transcript-delta';
      responseId: string;
      itemId: string;

      /**
       * Text chunk of the audio transcript.
       */
      delta: string;
      raw: unknown;
    }
  | {
      type: 'audio-transcript-done';
      responseId: string;
      itemId: string;
      transcript?: string;
      raw: unknown;
    }

  // ── Text output ────────────────────────────────────────────────────
  | {
      type: 'text-delta';
      responseId: string;
      itemId: string;

      /**
       * Text chunk of the model's text response.
       */
      delta: string;
      raw: unknown;
    }
  | {
      type: 'text-done';
      responseId: string;
      itemId: string;
      text?: string;
      raw: unknown;
    }

  // ── Function calling ───────────────────────────────────────────────
  | {
      type: 'function-call-arguments-delta';
      responseId: string;
      itemId: string;
      callId: string;

      /**
       * Partial JSON string of function call arguments.
       */
      delta: string;
      raw: unknown;
    }
  | {
      type: 'function-call-arguments-done';
      responseId: string;
      itemId: string;
      callId: string;

      /**
       * The name of the function to call.
       */
      name: string;

      /**
       * Complete JSON string of function call arguments.
       */
      arguments: string;
      raw: unknown;
    }

  // ── Error ──────────────────────────────────────────────────────────
  | {
      type: 'error';
      message: string;
      code?: string;
      raw: unknown;
    }

  // ── Custom / provider-specific ────────────────────────────────────
  | {
      type: 'custom';

      /**
       * The original event type string from the provider.
       */
      rawType: string;
      raw: unknown;
    };
