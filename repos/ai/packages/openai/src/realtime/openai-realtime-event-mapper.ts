import type {
  Experimental_RealtimeModelV4ClientEvent as RealtimeModelV4ClientEvent,
  Experimental_RealtimeModelV4ServerEvent as RealtimeModelV4ServerEvent,
  Experimental_RealtimeModelV4SessionConfig as RealtimeModelV4SessionConfig,
} from '@ai-sdk/provider';

type OpenAIRealtimeWireEvent = {
  type: string;
  session?: { id?: string };
  item?: { id?: string } & Record<string, unknown>;
  response?: { id?: string; status?: string };
  error?: { message?: string; code?: string };
  item_id: string;
  previous_item_id?: string;
  response_id: string;
  transcript?: string;
  delta: string;
  text?: string;
  call_id: string;
  name: string;
  arguments: string;
  message?: string;
  code?: string;
};

/**
 * Parses a raw OpenAI Realtime API server event into a normalized event.
 */
export function parseOpenAIRealtimeServerEvent(
  raw: unknown,
): RealtimeModelV4ServerEvent {
  const event = raw as OpenAIRealtimeWireEvent;
  const type = event.type;

  switch (type) {
    // ── Session lifecycle ──────────────────────────────────────────
    case 'session.created':
      return {
        type: 'session-created',
        sessionId: event.session?.id,
        raw,
      };

    case 'session.updated':
      return { type: 'session-updated', raw };

    // ── Input audio buffer ─────────────────────────────────────────
    case 'input_audio_buffer.speech_started':
      return {
        type: 'speech-started',
        itemId: event.item_id,
        raw,
      };

    case 'input_audio_buffer.speech_stopped':
      return {
        type: 'speech-stopped',
        itemId: event.item_id,
        raw,
      };

    case 'input_audio_buffer.committed':
      return {
        type: 'audio-committed',
        itemId: event.item_id,
        previousItemId: event.previous_item_id,
        raw,
      };

    // ── Conversation items ─────────────────────────────────────────
    case 'conversation.item.added':
      return {
        type: 'conversation-item-added',
        itemId: event.item?.id ?? event.item_id,
        item: event.item,
        raw,
      };

    case 'conversation.item.input_audio_transcription.completed':
      return {
        type: 'input-transcription-completed',
        itemId: event.item_id,
        transcript: event.transcript ?? '',
        raw,
      };

    // ── Response lifecycle ──────────────────────────────────────────
    case 'response.created':
      return {
        type: 'response-created',
        responseId: event.response?.id ?? event.response_id,
        raw,
      };

    case 'response.done':
      return {
        type: 'response-done',
        responseId: event.response?.id ?? event.response_id,
        status: event.response?.status ?? 'completed',
        raw,
      };

    // ── Output item lifecycle ───────────────────────────────────────
    case 'response.output_item.added':
      return {
        type: 'output-item-added',
        responseId: event.response_id,
        itemId: event.item?.id ?? event.item_id,
        raw,
      };

    case 'response.output_item.done':
      return {
        type: 'output-item-done',
        responseId: event.response_id,
        itemId: event.item?.id ?? event.item_id,
        raw,
      };

    case 'response.content_part.added':
      return {
        type: 'content-part-added',
        responseId: event.response_id,
        itemId: event.item_id,
        raw,
      };

    case 'response.content_part.done':
      return {
        type: 'content-part-done',
        responseId: event.response_id,
        itemId: event.item_id,
        raw,
      };

    // ── Audio output ────────────────────────────────────────────────
    case 'response.output_audio.delta':
      return {
        type: 'audio-delta',
        responseId: event.response_id,
        itemId: event.item_id,
        delta: event.delta,
        raw,
      };

    case 'response.output_audio.done':
      return {
        type: 'audio-done',
        responseId: event.response_id,
        itemId: event.item_id,
        raw,
      };

    // ── Audio transcript output ─────────────────────────────────────
    case 'response.output_audio_transcript.delta':
      return {
        type: 'audio-transcript-delta',
        responseId: event.response_id,
        itemId: event.item_id,
        delta: event.delta,
        raw,
      };

    case 'response.output_audio_transcript.done':
      return {
        type: 'audio-transcript-done',
        responseId: event.response_id,
        itemId: event.item_id,
        transcript: event.transcript,
        raw,
      };

    // ── Text output ─────────────────────────────────────────────────
    case 'response.output_text.delta':
      return {
        type: 'text-delta',
        responseId: event.response_id,
        itemId: event.item_id,
        delta: event.delta,
        raw,
      };

    case 'response.output_text.done':
      return {
        type: 'text-done',
        responseId: event.response_id,
        itemId: event.item_id,
        text: event.text,
        raw,
      };

    // ── Function calling ────────────────────────────────────────────
    case 'response.function_call_arguments.delta':
      return {
        type: 'function-call-arguments-delta',
        responseId: event.response_id,
        itemId: event.item_id,
        callId: event.call_id,
        delta: event.delta,
        raw,
      };

    case 'response.function_call_arguments.done':
      return {
        type: 'function-call-arguments-done',
        responseId: event.response_id,
        itemId: event.item_id,
        callId: event.call_id,
        name: event.name,
        arguments: event.arguments,
        raw,
      };

    // ── Error ───────────────────────────────────────────────────────
    case 'error':
      return {
        type: 'error',
        message: event.error?.message ?? event.message ?? 'Unknown error',
        code: event.error?.code ?? event.code,
        raw,
      };

    // ── Pass-through ────────────────────────────────────────────────
    default:
      return { type: 'custom', rawType: type, raw };
  }
}

/**
 * Serializes a normalized client event into OpenAI's Realtime API format.
 */
export function serializeOpenAIRealtimeClientEvent(
  event: RealtimeModelV4ClientEvent,
  modelId: string,
): unknown {
  switch (event.type) {
    case 'session-update':
      return {
        type: 'session.update',
        session: buildOpenAISessionConfig(event.config, modelId),
      };

    case 'input-audio-append':
      return {
        type: 'input_audio_buffer.append',
        audio: event.audio,
      };

    case 'input-audio-commit':
      return { type: 'input_audio_buffer.commit' };

    case 'input-audio-clear':
      return { type: 'input_audio_buffer.clear' };

    case 'conversation-item-create': {
      const item = event.item;
      switch (item.type) {
        case 'text-message':
          return {
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: item.role,
              content: [{ type: 'input_text', text: item.text }],
            },
          };
        case 'audio-message':
          return {
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: item.role,
              content: [{ type: 'input_audio', audio: item.audio }],
            },
          };
        case 'function-call-output':
          return {
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: item.callId,
              output: item.output,
            },
          };
      }
      break;
    }

    case 'conversation-item-truncate':
      return {
        type: 'conversation.item.truncate',
        item_id: event.itemId,
        content_index: event.contentIndex,
        audio_end_ms: event.audioEndMs,
      };

    case 'response-create':
      return {
        type: 'response.create',
        ...(event.options != null
          ? {
              response: {
                ...(event.options.modalities != null
                  ? { output_modalities: event.options.modalities }
                  : {}),
                ...(event.options.instructions != null
                  ? { instructions: event.options.instructions }
                  : {}),
                ...(event.options.metadata != null
                  ? { metadata: event.options.metadata }
                  : {}),
              },
            }
          : {}),
      };

    case 'response-cancel':
      return { type: 'response.cancel' };
  }
}

/**
 * Builds an OpenAI-specific session configuration from a normalized config.
 */
export function buildOpenAISessionConfig(
  config: RealtimeModelV4SessionConfig,
  modelId: string,
): Record<string, unknown> {
  const session: Record<string, unknown> = {
    type: 'realtime',
    model: modelId,
  };

  if (config.instructions != null) {
    session.instructions = config.instructions;
  }

  if (config.outputModalities != null) {
    session.output_modalities = config.outputModalities;
  }

  const audio: Record<string, unknown> = {};

  if (
    config.inputAudioFormat != null ||
    config.inputAudioTranscription != null ||
    config.turnDetection != null
  ) {
    const input: Record<string, unknown> = {};

    if (config.inputAudioFormat != null) {
      input.format = {
        type: config.inputAudioFormat.type,
        ...(config.inputAudioFormat.rate != null
          ? { rate: config.inputAudioFormat.rate }
          : {}),
      };
    }

    if (config.turnDetection != null) {
      if (config.turnDetection.type === 'disabled') {
        input.turn_detection = null;
      } else {
        const td: Record<string, unknown> = {
          type:
            config.turnDetection.type === 'server-vad'
              ? 'server_vad'
              : 'semantic_vad',
        };
        if (config.turnDetection.threshold != null) {
          td.threshold = config.turnDetection.threshold;
        }
        if (config.turnDetection.silenceDurationMs != null) {
          td.silence_duration_ms = config.turnDetection.silenceDurationMs;
        }
        if (config.turnDetection.prefixPaddingMs != null) {
          td.prefix_padding_ms = config.turnDetection.prefixPaddingMs;
        }
        input.turn_detection = td;
      }
    }

    if (config.inputAudioTranscription != null) {
      input.transcription = {
        model: config.inputAudioTranscription.model ?? 'gpt-realtime-whisper',
        ...(config.inputAudioTranscription.language != null
          ? { language: config.inputAudioTranscription.language }
          : {}),
        ...(config.inputAudioTranscription.prompt != null
          ? { prompt: config.inputAudioTranscription.prompt }
          : {}),
      };
    }

    audio.input = input;
  }

  if (config.outputAudioFormat != null || config.voice != null) {
    const output: Record<string, unknown> = {};

    if (config.outputAudioFormat != null) {
      output.format = {
        type: config.outputAudioFormat.type,
        ...(config.outputAudioFormat.rate != null
          ? { rate: config.outputAudioFormat.rate }
          : {}),
      };
    }

    if (config.voice != null) {
      output.voice = config.voice;
    }

    audio.output = output;
  }

  if (Object.keys(audio).length > 0) {
    session.audio = audio;
  }

  if (config.tools != null && config.tools.length > 0) {
    session.tools = config.tools.map(tool => ({
      type: tool.type,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
    session.tool_choice = 'auto';
  }

  if (config.providerOptions != null) {
    Object.assign(session, config.providerOptions);
  }

  return session;
}
