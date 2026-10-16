import type {
  Experimental_RealtimeModelV4 as RealtimeModelV4,
  Experimental_RealtimeModelV4ClientEvent as RealtimeModelV4ClientEvent,
  Experimental_RealtimeModelV4FunctionCallOutput as RealtimeModelV4FunctionCallOutput,
  Experimental_RealtimeModelV4ServerEvent as RealtimeModelV4ServerEvent,
  Experimental_RealtimeModelV4SessionConfig as RealtimeModelV4SessionConfig,
} from '@ai-sdk/provider';
import { safeParseJSON } from '@ai-sdk/provider-utils';
import { convertJSONSchemaToOpenAPISchema } from '../convert-json-schema-to-openapi-schema';
import { getModelPath } from '../get-model-path';
import type { GoogleRealtimeModelOptions } from './google-realtime-model-options';

type GoogleRealtimeFunctionCall = {
  id: string;
  name: string;
  args?: Record<string, unknown>;
};

type GoogleRealtimeServerContent = {
  interrupted?: boolean;
  modelTurn?: {
    parts?: Array<{
      inlineData?: { data?: string };
      text?: string;
    }>;
  };
  outputTranscription?: { text?: string };
  inputTranscription?: { text?: string };
  turnComplete?: boolean;
};

type GoogleRealtimeWireEvent = {
  setupComplete?: unknown;
  toolCall?: {
    functionCalls?: GoogleRealtimeFunctionCall[];
  };
  toolCallCancellation?: unknown;
  serverContent?: GoogleRealtimeServerContent;
  inputTranscription?: { text?: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Stateful event mapper for Google's Gemini Live API.
 *
 * Unlike OpenAI/xAI, Google's events don't have response/item IDs and
 * a single message can contain multiple pieces of data. This class
 * tracks turn state to generate consistent synthetic IDs.
 */
export class GoogleRealtimeEventMapper {
  private turnCounter = 0;
  private hasAudio = false;
  private hasText = false;
  private hasTranscript = false;
  private turnClosed = false;
  private inputAudioRate = 16000;

  private get responseId(): string {
    return `google-resp-${this.turnCounter}`;
  }

  private get itemId(): string {
    return `google-item-${this.turnCounter}`;
  }

  /**
   * Rolls over to the next turn lazily, only once new model content actually
   * arrives. `turnComplete` merely marks the current turn closed; the counter
   * is not advanced until the next response begins. This keeps a transcript
   * that arrives shortly after `turnComplete` attached to the turn it belongs
   * to, since Google delivers transcription independently with no guaranteed
   * ordering relative to `turnComplete`.
   */
  private beginTurnIfClosed(): void {
    if (!this.turnClosed) return;
    this.turnCounter++;
    this.hasAudio = false;
    this.hasText = false;
    this.hasTranscript = false;
    this.turnClosed = false;
  }

  parseServerEvent(
    raw: unknown,
  ): RealtimeModelV4ServerEvent | RealtimeModelV4ServerEvent[] {
    const data = raw as GoogleRealtimeWireEvent;

    if (data.setupComplete != null) {
      return { type: 'session-created', raw };
    }

    if (data.toolCall != null) {
      this.beginTurnIfClosed();
      const functionCalls = data.toolCall.functionCalls ?? [];
      return functionCalls.flatMap(functionCall => {
        const args = JSON.stringify(functionCall.args ?? {});
        return [
          {
            type: 'function-call-arguments-delta' as const,
            responseId: this.responseId,
            itemId: this.itemId,
            callId: functionCall.id,
            delta: args,
            raw,
          },
          {
            type: 'function-call-arguments-done' as const,
            responseId: this.responseId,
            itemId: this.itemId,
            callId: functionCall.id,
            name: functionCall.name,
            arguments: args,
            raw,
          },
        ];
      });
    }

    if (data.toolCallCancellation != null) {
      return {
        type: 'custom',
        rawType: 'toolCallCancellation',
        raw,
      };
    }

    if (data.serverContent != null) {
      return this.parseServerContent(data.serverContent, raw);
    }

    if (data.inputTranscription?.text != null) {
      return {
        type: 'input-transcription-completed',
        itemId: `google-input-${this.turnCounter}`,
        transcript: data.inputTranscription.text,
        raw,
      };
    }

    return { type: 'custom', rawType: String(Object.keys(data)[0]), raw };
  }

  private parseServerContent(
    serverContent: GoogleRealtimeServerContent,
    raw: unknown,
  ): RealtimeModelV4ServerEvent | RealtimeModelV4ServerEvent[] {
    const events: RealtimeModelV4ServerEvent[] = [];

    if (serverContent.interrupted) {
      events.push({
        type: 'speech-started',
        raw,
      });
    }

    if (serverContent.modelTurn?.parts) {
      // New model response content marks the start of the next turn.
      this.beginTurnIfClosed();
      for (const part of serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          this.hasAudio = true;
          events.push({
            type: 'audio-delta',
            responseId: this.responseId,
            itemId: this.itemId,
            delta: part.inlineData.data,
            raw,
          });
        }
        if (part.text) {
          this.hasText = true;
          events.push({
            type: 'text-delta',
            responseId: this.responseId,
            itemId: this.itemId,
            delta: part.text,
            raw,
          });
        }
      }
    }

    if (serverContent.outputTranscription?.text) {
      this.hasTranscript = true;
      events.push({
        type: 'audio-transcript-delta',
        responseId: this.responseId,
        itemId: this.itemId,
        delta: serverContent.outputTranscription.text,
        raw,
      });
    }

    if (serverContent.inputTranscription?.text) {
      events.push({
        type: 'input-transcription-completed',
        itemId: `google-input-${this.turnCounter}`,
        transcript: serverContent.inputTranscription.text,
        raw,
      });
    }

    if (serverContent.turnComplete) {
      if (this.hasAudio) {
        events.push({
          type: 'audio-done',
          responseId: this.responseId,
          itemId: this.itemId,
          raw,
        });
      }
      if (this.hasText) {
        events.push({
          type: 'text-done',
          responseId: this.responseId,
          itemId: this.itemId,
          raw,
        });
      }
      if (this.hasTranscript) {
        events.push({
          type: 'audio-transcript-done',
          responseId: this.responseId,
          itemId: this.itemId,
          raw,
        });
      }
      events.push({
        type: 'response-done',
        responseId: this.responseId,
        status: 'completed',
        raw,
      });
      // Mark the turn closed but defer advancing the counter until the next
      // response actually begins (see `beginTurnIfClosed`).
      this.turnClosed = true;
    }

    if (events.length === 0) {
      return { type: 'custom', rawType: 'serverContent', raw };
    }

    return events.length === 1 ? events[0] : events;
  }

  serializeClientEvent(
    event: RealtimeModelV4ClientEvent,
    modelId: string,
  ): ReturnType<RealtimeModelV4['serializeClientEvent']> {
    switch (event.type) {
      case 'session-update':
        // Capture the configured capture rate so input audio blobs advertise
        // the real rate. Google accepts any rate as long as the blob's mimeType
        // matches; a mismatched label corrupts custom-rate audio.
        if (event.config.inputAudioFormat?.rate != null) {
          this.inputAudioRate = event.config.inputAudioFormat.rate;
        }
        return {
          setup: buildGoogleSessionConfig(event.config, modelId),
        };

      case 'input-audio-append':
        return {
          realtimeInput: {
            audio: {
              data: event.audio,
              mimeType: `audio/pcm;rate=${this.inputAudioRate}`,
            },
          },
        };

      case 'input-audio-commit':
        return {
          realtimeInput: {
            audioStreamEnd: true,
          },
        };

      case 'input-audio-clear':
      case 'response-create':
      case 'response-cancel':
      case 'conversation-item-truncate':
        return null;

      case 'conversation-item-create': {
        const item = event.item;
        switch (item.type) {
          case 'text-message':
            return {
              realtimeInput: {
                text: item.text,
              },
            };
          case 'function-call-output':
            return serializeFunctionCallOutput(item);
          case 'audio-message':
            return null;
        }
        break;
      }
    }

    return null;
  }
}

async function serializeFunctionCallOutput(
  item: RealtimeModelV4FunctionCallOutput,
): Promise<unknown> {
  const parseResult = await safeParseJSON({ text: item.output });
  const response = parseResult.success ? parseResult.value : {};

  return {
    toolResponse: {
      functionResponses: [
        {
          id: item.callId,
          name: item.name,
          response,
        },
      ],
    },
  };
}

/**
 * Builds a Google-specific session configuration from a normalized config.
 * Used to construct the `bidiGenerateContentSetup` payload for auth token creation.
 */
export function buildGoogleSessionConfig(
  config: RealtimeModelV4SessionConfig | undefined,
  modelId: string,
): Record<string, unknown> {
  const setup: Record<string, unknown> = {
    model: getModelPath(modelId),
  };

  const generationConfig: Record<string, unknown> = {};

  if (config?.outputModalities != null) {
    generationConfig.responseModalities = config.outputModalities.map(m =>
      m.toUpperCase(),
    );
  } else {
    generationConfig.responseModalities = ['AUDIO'];
  }

  if (config?.voice != null) {
    generationConfig.speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: config.voice,
        },
      },
    };
  }

  setup.generationConfig = generationConfig;

  if (config?.instructions != null) {
    setup.systemInstruction = {
      parts: [{ text: config.instructions }],
    };
  }

  if (config?.tools != null && config.tools.length > 0) {
    setup.tools = [
      {
        functionDeclarations: config.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: convertJSONSchemaToOpenAPISchema(tool.parameters),
        })),
      },
    ];
  }

  if (config?.inputAudioTranscription != null) {
    setup.inputAudioTranscription = {};
  }

  if (config?.outputAudioTranscription != null) {
    setup.outputAudioTranscription = {};
  }

  if (config?.providerOptions == null) {
    return setup;
  }

  const { google, ...providerOptions } = config.providerOptions;
  Object.assign(setup, providerOptions);

  const googleOptions = isRecord(google)
    ? (google as GoogleRealtimeModelOptions)
    : undefined;

  if (googleOptions?.translationConfig != null) {
    const target = isRecord(setup.generationConfig)
      ? setup.generationConfig
      : generationConfig;
    setup.generationConfig = {
      ...target,
      translationConfig: googleOptions.translationConfig,
    };
  }

  return setup;
}
