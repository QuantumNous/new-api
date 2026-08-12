import type {
  AssistantContent,
  AssistantModelMessage,
  ToolContent,
  ToolModelMessage,
} from '../prompt';
import { createToolModelOutput } from '../prompt/create-tool-model-output';
import type { ContentPart } from './content-part';
import type { ToolSet } from '@ai-sdk/provider-utils';

/**
 * Converts the result of a `generateText` or `streamText` call to a list of response messages.
 */
export async function toResponseMessages<TOOLS extends ToolSet>({
  content: inputContent,
  tools,
}: {
  content: Array<ContentPart<TOOLS>>;
  tools: TOOLS | undefined;
}): Promise<Array<AssistantModelMessage | ToolModelMessage>> {
  const responseMessages: Array<AssistantModelMessage | ToolModelMessage> = [];
  const toolCallOrder = new Map<string, number>();

  const content: AssistantContent = [];
  for (const part of inputContent) {
    // Skip sources - they are response-only content that no provider expects back
    if (part.type === 'source') {
      continue;
    }

    // Skip non-provider-executed tool results/errors (they go in the tool message)
    if (
      (part.type === 'tool-result' || part.type === 'tool-error') &&
      !part.providerExecuted
    ) {
      continue;
    }

    // Skip empty text
    if (part.type === 'text' && part.text.length === 0) {
      continue;
    }

    switch (part.type) {
      case 'text':
        content.push({
          type: 'text',
          text: part.text,
          providerOptions: part.providerMetadata,
        });
        break;
      case 'custom':
        content.push({
          type: 'custom',
          kind: part.kind,
          providerOptions: part.providerMetadata,
        });
        break;
      case 'reasoning':
        content.push({
          type: 'reasoning',
          text: part.text,
          providerOptions: part.providerMetadata,
        });
        break;
      case 'file':
        content.push({
          type: 'file',
          data: part.file.base64,
          mediaType: part.file.mediaType,
          providerOptions: part.providerMetadata,
        });
        break;
      case 'reasoning-file':
        content.push({
          type: 'reasoning-file',
          data: part.file.base64,
          mediaType: part.file.mediaType,
          providerOptions: part.providerMetadata,
        });
        break;
      case 'tool-call':
        if (!toolCallOrder.has(part.toolCallId)) {
          toolCallOrder.set(part.toolCallId, toolCallOrder.size);
        }
        content.push({
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input:
            part.invalid && typeof part.input !== 'object' ? {} : part.input,
          providerExecuted: part.providerExecuted,
          providerOptions: part.providerMetadata,
        });
        break;
      case 'tool-result': {
        const output = await createToolModelOutput({
          toolCallId: part.toolCallId,
          input: part.input,
          tool: tools?.[part.toolName],
          output: part.output,
          errorMode: 'none',
        });
        content.push({
          type: 'tool-result',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output,
          providerOptions: part.providerMetadata,
        });
        break;
      }
      case 'tool-error': {
        const output = await createToolModelOutput({
          toolCallId: part.toolCallId,
          input: part.input,
          tool: tools?.[part.toolName],
          output: part.error,
          errorMode: 'json',
        });
        content.push({
          type: 'tool-result',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output,
          providerOptions: part.providerMetadata,
        });
        break;
      }
      case 'tool-approval-request':
        content.push({
          type: 'tool-approval-request',
          approvalId: part.approvalId,
          toolCallId: part.toolCall.toolCallId,
          isAutomatic: part.isAutomatic,
          ...(part.signature != null ? { signature: part.signature } : {}),
        });
        break;
    }
  }

  if (content.length > 0) {
    responseMessages.push({
      role: 'assistant',
      content,
    });
  }

  const toolResultContent: ToolContent = [];
  for (const part of inputContent) {
    if (
      part.type !== 'tool-approval-response' &&
      part.type !== 'tool-result' &&
      part.type !== 'tool-error'
    ) {
      continue;
    }

    if (part.type === 'tool-approval-response') {
      toolResultContent.push({
        type: 'tool-approval-response',
        approvalId: part.approvalId,
        approved: part.approved,
        reason: part.reason,
        providerExecuted: part.providerExecuted,
      });

      // when the tool approval is denied,
      // we need to add an execution-denied tool result
      // since there is no corresponding tool result for the tool call
      if (part.approved === false) {
        toolResultContent.push({
          type: 'tool-result',
          toolCallId: part.toolCall.toolCallId,
          toolName: part.toolCall.toolName,
          output: {
            type: 'execution-denied' as const,
            reason: part.reason,
          },
        });
      }
      continue;
    }

    if (part.providerExecuted) {
      continue;
    }

    const output = await createToolModelOutput({
      toolCallId: part.toolCallId,
      input: part.input,
      tool: tools?.[part.toolName],
      output: part.type === 'tool-result' ? part.output : part.error,
      errorMode: part.type === 'tool-error' ? 'text' : 'none',
    });

    toolResultContent.push({
      type: 'tool-result',
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      output,
      ...(part.providerMetadata != null
        ? { providerOptions: part.providerMetadata }
        : {}),
    });
  }

  if (toolResultContent.length > 0) {
    responseMessages.push({
      role: 'tool',
      content: sortToolResultContentByToolCallOrder({
        toolResultContent,
        toolCallOrder,
      }),
    });
  }

  return responseMessages;
}

function sortToolResultContentByToolCallOrder({
  toolResultContent,
  toolCallOrder,
}: {
  toolResultContent: ToolContent;
  toolCallOrder: Map<string, number>;
}): ToolContent {
  const sortedToolResults = toolResultContent
    .filter(part => part.type === 'tool-result')
    .map((part, index) => ({ part, index }))
    .sort((a, b) => {
      const aOrder = toolCallOrder.get(a.part.toolCallId);
      const bOrder = toolCallOrder.get(b.part.toolCallId);

      if (aOrder == null && bOrder == null) {
        return a.index - b.index;
      }

      if (aOrder == null) {
        return 1;
      }

      if (bOrder == null) {
        return -1;
      }

      return aOrder - bOrder || a.index - b.index;
    })
    .map(({ part }) => part);

  let toolResultIndex = 0;

  return toolResultContent.map(part =>
    part.type === 'tool-result' ? sortedToolResults[toolResultIndex++] : part,
  );
}
