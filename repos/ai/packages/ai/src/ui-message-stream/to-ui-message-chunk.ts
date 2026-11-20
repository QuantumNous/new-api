import type { ToolSet } from '@ai-sdk/provider-utils';
import type { TextStreamPart } from '../generate-text/stream-text-result';
import type {
  InferUIMessageData,
  InferUIMessageMetadata,
  UIMessage,
} from '../ui/ui-messages';
import type { InferUIMessageChunk, UIMessageChunk } from './ui-message-chunks';

export type ToUIMessageChunkOptions<
  TOOLS extends ToolSet = ToolSet,
  UI_MESSAGE extends UIMessage = UIMessage,
> = {
  tools?: TOOLS;
  sendReasoning?: boolean;
  sendSources?: boolean;
  sendStart?: boolean;
  sendFinish?: boolean;
  onError?: (error: unknown) => string;
  messageMetadata?: InferUIMessageMetadata<UI_MESSAGE>;
  responseMessageId?: string;
};

/**
 * Converts a single `TextStreamPart` (as emitted by `streamText`'s
 * `stream`) into a `UIMessageChunk`.
 *
 * Returns `undefined` for stream parts that do not produce UI message chunks.
 */
export function toUIMessageChunk<
  TOOLS extends ToolSet = ToolSet,
  UI_MESSAGE extends UIMessage = UIMessage,
>(
  part: TextStreamPart<TOOLS>,
  {
    tools,
    sendReasoning = true,
    sendSources = false,
    sendStart = true,
    sendFinish = true,
    onError = () => 'An error occurred.', // prevent leaking server error details to the client by default
    messageMetadata,
    responseMessageId,
  }: ToUIMessageChunkOptions<TOOLS, UI_MESSAGE> = {},
): InferUIMessageChunk<UI_MESSAGE> | undefined {
  // TODO simplify once dynamic is no longer needed for invalid tool inputs
  const isDynamic = (toolPart: { toolName: string; dynamic?: boolean }) => {
    const tool = tools?.[toolPart.toolName];

    // provider-executed, dynamic tools are not listed in the tools object
    if (tool == null) {
      return toolPart.dynamic;
    }

    return tool?.type === 'dynamic' ? true : undefined;
  };

  const partType = part.type;
  switch (partType) {
    case 'text-start': {
      return {
        type: 'text-start',
        id: part.id,
        ...(part.providerMetadata != null
          ? { providerMetadata: part.providerMetadata }
          : {}),
      };
    }

    case 'text-delta': {
      return {
        type: 'text-delta',
        id: part.id,
        delta: part.text,
        ...(part.providerMetadata != null
          ? { providerMetadata: part.providerMetadata }
          : {}),
      };
    }

    case 'text-end': {
      return {
        type: 'text-end',
        id: part.id,
        ...(part.providerMetadata != null
          ? { providerMetadata: part.providerMetadata }
          : {}),
      };
    }

    case 'reasoning-start':
    case 'reasoning-end': {
      if (!sendReasoning) {
        return undefined;
      }

      return {
        type: partType,
        id: part.id,
        ...(part.providerMetadata != null
          ? { providerMetadata: part.providerMetadata }
          : {}),
      };
    }

    case 'reasoning-delta': {
      if (!sendReasoning) {
        return undefined;
      }

      return {
        type: 'reasoning-delta',
        id: part.id,
        delta: part.text,
        ...(part.providerMetadata != null
          ? { providerMetadata: part.providerMetadata }
          : {}),
      };
    }

    case 'file':
    case 'reasoning-file': {
      if (partType === 'reasoning-file' && !sendReasoning) {
        return undefined;
      }

      return {
        type: part.type,
        mediaType: part.file.mediaType,
        url: `data:${part.file.mediaType};base64,${part.file.base64}`,
        ...(part.providerMetadata != null
          ? { providerMetadata: part.providerMetadata }
          : {}),
      };
    }

    case 'source': {
      if (!sendSources) {
        return undefined;
      }

      if (part.sourceType === 'url') {
        return {
          type: 'source-url',
          sourceId: part.id,
          url: part.url,
          title: part.title,
          ...(part.providerMetadata != null
            ? { providerMetadata: part.providerMetadata }
            : {}),
        };
      }

      if (part.sourceType === 'document') {
        return {
          type: 'source-document',
          sourceId: part.id,
          mediaType: part.mediaType,
          title: part.title,
          filename: part.filename,
          ...(part.providerMetadata != null
            ? { providerMetadata: part.providerMetadata }
            : {}),
        };
      }

      return undefined;
    }

    case 'custom': {
      return {
        type: 'custom',
        kind: part.kind,
        ...(part.providerMetadata != null
          ? { providerMetadata: part.providerMetadata }
          : {}),
      };
    }

    case 'tool-input-start': {
      const dynamic = isDynamic(part);

      return {
        type: 'tool-input-start',
        toolCallId: part.id,
        toolName: part.toolName,
        ...(part.providerExecuted != null
          ? { providerExecuted: part.providerExecuted }
          : {}),
        ...(part.providerMetadata != null
          ? { providerMetadata: part.providerMetadata }
          : {}),
        ...(part.toolMetadata != null
          ? { toolMetadata: part.toolMetadata }
          : {}),
        ...(dynamic != null ? { dynamic } : {}),
        ...(part.title != null ? { title: part.title } : {}),
      };
    }

    case 'tool-input-delta': {
      return {
        type: 'tool-input-delta',
        toolCallId: part.id,
        inputTextDelta: part.delta,
      };
    }

    case 'tool-call': {
      const dynamic = isDynamic(part);

      if (part.invalid) {
        return {
          type: 'tool-input-error',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input,
          ...(part.providerExecuted != null
            ? { providerExecuted: part.providerExecuted }
            : {}),
          ...(part.providerMetadata != null
            ? { providerMetadata: part.providerMetadata }
            : {}),
          ...(part.toolMetadata != null
            ? { toolMetadata: part.toolMetadata }
            : {}),
          ...(dynamic != null ? { dynamic } : {}),
          errorText: onError(part.error),
          ...(part.title != null ? { title: part.title } : {}),
        };
      }

      return {
        type: 'tool-input-available',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: part.input,
        ...(part.providerExecuted != null
          ? { providerExecuted: part.providerExecuted }
          : {}),
        ...(part.providerMetadata != null
          ? { providerMetadata: part.providerMetadata }
          : {}),
        ...(part.toolMetadata != null
          ? { toolMetadata: part.toolMetadata }
          : {}),
        ...(dynamic != null ? { dynamic } : {}),
        ...(part.title != null ? { title: part.title } : {}),
      };
    }

    case 'tool-approval-request': {
      return {
        type: 'tool-approval-request',
        approvalId: part.approvalId,
        toolCallId: part.toolCall.toolCallId,
        ...(part.isAutomatic != null ? { isAutomatic: part.isAutomatic } : {}),
        ...(part.signature != null ? { signature: part.signature } : {}),
      };
    }

    case 'tool-approval-response': {
      return {
        type: 'tool-approval-response',
        approvalId: part.approvalId,
        approved: part.approved,
        ...(part.reason != null ? { reason: part.reason } : {}),
        ...(part.providerExecuted != null
          ? { providerExecuted: part.providerExecuted }
          : {}),
      };
    }

    case 'tool-result': {
      const dynamic = isDynamic(part);

      return {
        type: 'tool-output-available',
        toolCallId: part.toolCallId,
        // UI stream chunks are serialized as JSON, which drops undefined
        // properties. Use null so tool outputs always keep the output field.
        output: part.output === undefined ? null : part.output,
        ...(part.providerExecuted != null
          ? { providerExecuted: part.providerExecuted }
          : {}),
        ...(part.providerMetadata != null
          ? { providerMetadata: part.providerMetadata }
          : {}),
        ...(part.toolMetadata != null
          ? { toolMetadata: part.toolMetadata }
          : {}),
        ...(part.preliminary != null ? { preliminary: part.preliminary } : {}),
        ...(dynamic != null ? { dynamic } : {}),
      };
    }

    case 'tool-error': {
      const dynamic = isDynamic(part);

      return {
        type: 'tool-output-error',
        toolCallId: part.toolCallId,
        errorText: part.providerExecuted
          ? typeof part.error === 'string'
            ? part.error
            : JSON.stringify(part.error)
          : onError(part.error),
        ...(part.providerExecuted != null
          ? { providerExecuted: part.providerExecuted }
          : {}),
        ...(part.providerMetadata != null
          ? { providerMetadata: part.providerMetadata }
          : {}),
        ...(part.toolMetadata != null
          ? { toolMetadata: part.toolMetadata }
          : {}),
        ...(dynamic != null ? { dynamic } : {}),
      };
    }

    case 'tool-output-denied': {
      return {
        type: 'tool-output-denied',
        toolCallId: part.toolCallId,
      };
    }

    case 'error': {
      return {
        type: 'error',
        errorText: onError(part.error),
      };
    }

    case 'start-step': {
      return { type: 'start-step' };
    }

    case 'finish-step': {
      return { type: 'finish-step' };
    }

    case 'start': {
      if (!sendStart) {
        return undefined;
      }

      return {
        type: 'start',
        ...(messageMetadata != null ? { messageMetadata } : {}),
        ...(responseMessageId != null ? { messageId: responseMessageId } : {}),
      } as UIMessageChunk<
        InferUIMessageMetadata<UI_MESSAGE>,
        InferUIMessageData<UI_MESSAGE>
      >;
    }

    case 'finish': {
      if (!sendFinish) {
        return undefined;
      }

      return {
        type: 'finish',
        finishReason: part.finishReason,
        ...(messageMetadata != null ? { messageMetadata } : {}),
      } as UIMessageChunk<
        InferUIMessageMetadata<UI_MESSAGE>,
        InferUIMessageData<UI_MESSAGE>
      >;
    }

    case 'abort': {
      return part;
    }

    case 'tool-input-end':
    case 'raw': {
      return undefined;
    }

    default: {
      const exhaustiveCheck: never = partType;
      throw new Error(`Unknown chunk type: ${exhaustiveCheck}`);
    }
  }
}
