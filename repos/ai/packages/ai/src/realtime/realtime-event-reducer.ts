import { safeParseJSON } from '@ai-sdk/provider-utils';
import type { RealtimeServerEvent } from '../types/realtime-model';
import type {
  DynamicToolUIPart,
  TextUIPart,
  UIMessage,
} from '../ui/ui-messages';

export type RealtimeStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface RealtimeState {
  status: RealtimeStatus;
  messages: UIMessage[];
  events: RealtimeServerEvent[];
  isCapturing: boolean;
  isPlaying: boolean;
}

export type RealtimeReducerEffect =
  | {
      type: 'play-audio';
      itemId: string;
      delta: string;
    }
  | {
      type: 'speech-started';
    }
  | {
      type: 'tool-call';
      callId: string;
      name: string;
      args: Record<string, unknown>;
      rawArguments: string;
    }
  | {
      type: 'error';
      error: Error;
    };

export type RealtimeToolOutput = {
  callId: string;
  name?: string;
  output: string;
};

export function createInitialRealtimeState(): RealtimeState {
  return {
    status: 'disconnected',
    messages: [],
    events: [],
    isCapturing: false,
    isPlaying: false,
  };
}

export class RealtimeEventReducer {
  private currentAssistantMessageId: string | null = null;
  private textAccumulators = new Map<string, string>();
  private toolArgAccumulators = new Map<string, string>();
  private toolCallIdToMessageId = new Map<string, string>();
  private toolCallIdToName = new Map<string, string>();
  private inputAudioMessageInsertIndex = new Map<string, number>();
  private itemIdToPartLocation = new Map<
    string,
    { messageId: string; partIndex: number }
  >();

  constructor(private readonly maxEvents = 500) {}

  setStatus(state: RealtimeState, status: RealtimeStatus): RealtimeState {
    return { ...state, status };
  }

  setCapturing(state: RealtimeState, isCapturing: boolean): RealtimeState {
    return { ...state, isCapturing };
  }

  setPlaying(state: RealtimeState, isPlaying: boolean): RealtimeState {
    return { ...state, isPlaying };
  }

  addUserTextMessage(state: RealtimeState, text: string): RealtimeState {
    return {
      ...state,
      messages: [
        ...state.messages,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          parts: [{ type: 'text', text, state: 'done' } as TextUIPart],
        },
      ],
    };
  }

  addToolOutput(
    state: RealtimeState,
    callId: string,
    result: unknown,
  ): { state: RealtimeState; output: RealtimeToolOutput } {
    return {
      state: this.updateToolPartState(state, callId, result),
      output: {
        callId,
        name: this.toolCallIdToName.get(callId),
        output: JSON.stringify(result),
      },
    };
  }

  async reduceServerEvent(
    state: RealtimeState,
    event: RealtimeServerEvent,
  ): Promise<{ state: RealtimeState; effects: RealtimeReducerEffect[] }> {
    let nextState = this.pushEvent(state, event);
    const effects: RealtimeReducerEffect[] = [];

    switch (event.type) {
      case 'session-created':
      case 'session-updated': {
        if (nextState.status === 'connecting') {
          nextState = this.setStatus(nextState, 'connected');
        }
        break;
      }

      case 'audio-delta': {
        effects.push({
          type: 'play-audio',
          itemId: event.itemId,
          delta: event.delta,
        });
        break;
      }

      case 'audio-committed': {
        if (event.itemId != null) {
          this.inputAudioMessageInsertIndex.set(
            event.itemId,
            nextState.messages.length,
          );
        }
        break;
      }

      case 'audio-transcript-delta':
      case 'text-delta': {
        nextState = this.appendTextDelta(nextState, event.itemId, event.delta);
        break;
      }

      case 'audio-transcript-done': {
        nextState = this.finalizeText(
          nextState,
          event.itemId,
          event.transcript,
        );
        break;
      }

      case 'text-done': {
        nextState = this.finalizeText(nextState, event.itemId, event.text);
        break;
      }

      case 'input-transcription-completed': {
        nextState = this.addInputTranscriptionMessage(
          nextState,
          event.itemId,
          event.transcript,
        );
        break;
      }

      case 'response-created':
      case 'response-done': {
        this.currentAssistantMessageId = null;
        break;
      }

      case 'speech-started': {
        this.currentAssistantMessageId = null;
        effects.push({ type: 'speech-started' });
        break;
      }

      case 'function-call-arguments-delta': {
        const { state: updatedState, messageId } =
          this.getOrCreateAssistantMessage(nextState);
        nextState = updatedState;
        this.toolCallIdToMessageId.set(event.callId, messageId);

        const acc = this.toolArgAccumulators.get(event.callId) ?? '';
        this.toolArgAccumulators.set(event.callId, acc + event.delta);

        nextState = this.ensureToolPart(nextState, messageId, event.callId);
        break;
      }

      case 'function-call-arguments-done': {
        this.toolArgAccumulators.delete(event.callId);
        this.toolCallIdToName.set(event.callId, event.name);

        const parseResult = await safeParseJSON({ text: event.arguments });
        const parsedInput = parseResult.success
          ? (parseResult.value as Record<string, unknown>)
          : {};

        const messageId = this.toolCallIdToMessageId.get(event.callId);
        if (messageId != null) {
          nextState = this.markToolInputAvailable(
            nextState,
            messageId,
            event.callId,
            event.name,
            parsedInput,
          );
        }

        if (!parseResult.success) {
          effects.push({
            type: 'error',
            error: new Error(
              `Failed to parse tool arguments: ${event.arguments}`,
            ),
          });
        } else {
          effects.push({
            type: 'tool-call',
            callId: event.callId,
            name: event.name,
            args: parsedInput,
            rawArguments: event.arguments,
          });
        }
        break;
      }

      case 'error': {
        effects.push({ type: 'error', error: new Error(event.message) });
        break;
      }
    }

    return { state: nextState, effects };
  }

  private pushEvent(
    state: RealtimeState,
    event: RealtimeServerEvent,
  ): RealtimeState {
    const events = [...state.events, event];
    return {
      ...state,
      events:
        events.length > this.maxEvents ? events.slice(-this.maxEvents) : events,
    };
  }

  private getOrCreateAssistantMessage(state: RealtimeState): {
    state: RealtimeState;
    messageId: string;
  } {
    if (this.currentAssistantMessageId != null) {
      return { state, messageId: this.currentAssistantMessageId };
    }

    const messageId = `assistant-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    this.currentAssistantMessageId = messageId;

    return {
      state: {
        ...state,
        messages: [
          ...state.messages,
          {
            id: messageId,
            role: 'assistant',
            parts: [],
          },
        ],
      },
      messageId,
    };
  }

  private addInputTranscriptionMessage(
    state: RealtimeState,
    itemId: string,
    transcript: string,
  ): RealtimeState {
    const messageId = `user-${itemId}`;
    const existingMessage = state.messages.find(
      message => message.id === messageId,
    );

    if (existingMessage != null) {
      return {
        ...state,
        messages: state.messages.map(message =>
          message.id === messageId
            ? {
                ...message,
                parts: [
                  {
                    type: 'text',
                    text: transcript,
                    state: 'done',
                  } as TextUIPart,
                ],
              }
            : message,
        ),
      };
    }

    const insertIndex = Math.min(
      this.inputAudioMessageInsertIndex.get(itemId) ?? state.messages.length,
      state.messages.length,
    );

    const messages = [...state.messages];
    messages.splice(insertIndex, 0, {
      id: messageId,
      role: 'user',
      parts: [
        {
          type: 'text',
          text: transcript,
          state: 'done',
        } as TextUIPart,
      ],
    });

    return {
      ...state,
      messages,
    };
  }

  private appendTextDelta(
    state: RealtimeState,
    itemId: string,
    delta: string,
  ): RealtimeState {
    const { state: stateWithMessage, messageId } =
      this.getOrCreateAssistantMessage(state);

    const acc = this.textAccumulators.get(itemId) ?? '';
    const text = acc + delta;
    this.textAccumulators.set(itemId, text);

    const location = this.itemIdToPartLocation.get(itemId);
    if (location != null) {
      return this.updateMessagePart(
        stateWithMessage,
        location.messageId,
        location.partIndex,
        { type: 'text', text, state: 'streaming' } as TextUIPart,
      );
    }

    return {
      ...stateWithMessage,
      messages: stateWithMessage.messages.map(message => {
        if (message.id !== messageId) return message;

        const partIndex = message.parts.length;
        this.itemIdToPartLocation.set(itemId, { messageId, partIndex });

        return {
          ...message,
          parts: [
            ...message.parts,
            { type: 'text', text, state: 'streaming' } as TextUIPart,
          ],
        };
      }),
    };
  }

  private finalizeText(
    state: RealtimeState,
    itemId: string,
    finalText?: string,
  ): RealtimeState {
    const text = finalText ?? this.textAccumulators.get(itemId) ?? '';
    this.textAccumulators.delete(itemId);

    const location = this.itemIdToPartLocation.get(itemId);
    if (location == null) return state;

    this.itemIdToPartLocation.delete(itemId);

    return this.updateMessagePart(
      state,
      location.messageId,
      location.partIndex,
      { type: 'text', text, state: 'done' } as TextUIPart,
    );
  }

  private ensureToolPart(
    state: RealtimeState,
    messageId: string,
    callId: string,
  ): RealtimeState {
    return {
      ...state,
      messages: state.messages.map(message => {
        if (message.id !== messageId) return message;

        const existingPart = message.parts.find(
          part =>
            part.type === 'dynamic-tool' &&
            (part as DynamicToolUIPart).toolCallId === callId,
        );
        if (existingPart != null) return message;

        return {
          ...message,
          parts: [
            ...message.parts,
            {
              type: 'dynamic-tool',
              toolName: '',
              toolCallId: callId,
              state: 'input-streaming',
              input: undefined,
            } as DynamicToolUIPart,
          ],
        };
      }),
    };
  }

  private markToolInputAvailable(
    state: RealtimeState,
    messageId: string,
    callId: string,
    name: string,
    input: Record<string, unknown>,
  ): RealtimeState {
    return {
      ...state,
      messages: state.messages.map(message => {
        if (message.id !== messageId) return message;

        return {
          ...message,
          parts: message.parts.map(part => {
            if (part.type !== 'dynamic-tool') return part;
            const toolPart = part as DynamicToolUIPart;
            if (toolPart.toolCallId !== callId) return part;

            return {
              ...toolPart,
              toolName: name,
              state: 'input-available',
              input,
            } as DynamicToolUIPart;
          }),
        };
      }),
    };
  }

  private updateToolPartState(
    state: RealtimeState,
    callId: string,
    result: unknown,
  ): RealtimeState {
    const messageId = this.toolCallIdToMessageId.get(callId);
    if (messageId == null) return state;

    return {
      ...state,
      messages: state.messages.map(message => {
        if (message.id !== messageId) return message;

        return {
          ...message,
          parts: message.parts.map(part => {
            if (part.type !== 'dynamic-tool') return part;
            const toolPart = part as DynamicToolUIPart;
            if (toolPart.toolCallId !== callId) return part;

            return {
              ...toolPart,
              state: 'output-available',
              output: result,
            } as DynamicToolUIPart;
          }),
        };
      }),
    };
  }

  private updateMessagePart(
    state: RealtimeState,
    messageId: string,
    partIndex: number,
    part: TextUIPart,
  ): RealtimeState {
    return {
      ...state,
      messages: state.messages.map(message => {
        if (message.id !== messageId) return message;

        const parts = [...message.parts];
        parts[partIndex] = part;

        return { ...message, parts };
      }),
    };
  }
}
