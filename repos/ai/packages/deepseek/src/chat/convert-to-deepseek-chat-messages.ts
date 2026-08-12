import type {
  LanguageModelV4CallOptions,
  LanguageModelV4Prompt,
  SharedV4Warning,
} from '@ai-sdk/provider';
import type { DeepSeekChatPrompt } from './deepseek-chat-api-types';

export function convertToDeepSeekChatMessages({
  prompt,
  responseFormat,
  modelId,
}: {
  prompt: LanguageModelV4Prompt;
  responseFormat: LanguageModelV4CallOptions['responseFormat'];
  modelId: string;
}): {
  messages: DeepSeekChatPrompt;
  warnings: Array<SharedV4Warning>;
} {
  const isDeepSeekV4 = modelId.includes('deepseek-v4');
  const messages: DeepSeekChatPrompt = [];
  const warnings: Array<SharedV4Warning> = [];

  // Inject system message if response format is JSON
  if (responseFormat?.type === 'json') {
    if (responseFormat.schema == null) {
      messages.push({
        role: 'system',
        content: 'Return JSON.',
      });
    } else {
      messages.push({
        role: 'system',
        content:
          'Return JSON that conforms to the following schema: ' +
          JSON.stringify(responseFormat.schema),
      });
      warnings.push({
        type: 'compatibility',
        feature: 'responseFormat JSON schema',
        details: 'JSON response schema is injected into the system message.',
      });
    }
  }

  // TODO use findLastIndex once we use ES2023
  let lastUserMessageIndex = -1;
  for (let i = prompt.length - 1; i >= 0; i--) {
    if (prompt[i].role === 'user') {
      lastUserMessageIndex = i;
      break;
    }
  }

  let index = -1;
  for (const { role, content } of prompt) {
    index++;

    switch (role) {
      case 'system': {
        messages.push({ role: 'system', content });
        break;
      }

      case 'user': {
        let userContent = '';
        for (const part of content) {
          if (part.type === 'text') {
            userContent += part.text;
          } else {
            warnings.push({
              type: 'unsupported',
              feature: `user message part type: ${part.type}`,
            });
          }
        }

        messages.push({
          role: 'user',
          content: userContent,
        });

        break;
      }
      case 'assistant': {
        let text = '';
        let reasoning: string | undefined;

        const toolCalls: Array<{
          id: string;
          type: 'function';
          function: { name: string; arguments: string };
        }> = [];

        for (const part of content) {
          switch (part.type) {
            case 'text': {
              text += part.text;
              break;
            }
            case 'reasoning': {
              // R1 must not receive prior reasoning; V4 requires it.
              if (index <= lastUserMessageIndex && !isDeepSeekV4) {
                break;
              }

              if (reasoning == null) {
                reasoning = part.text;
              } else {
                reasoning += part.text;
              }
              break;
            }
            case 'tool-call': {
              toolCalls.push({
                id: part.toolCallId,
                type: 'function',
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.input),
                },
              });
              break;
            }
          }
        }

        // V4 demands the field on every assistant turn — back-fill an empty
        // string when the source message had no reasoning part at all.
        messages.push({
          role: 'assistant',
          content: text,
          reasoning_content: reasoning ?? (isDeepSeekV4 ? '' : undefined),
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        });

        break;
      }

      case 'tool': {
        for (const toolResponse of content) {
          if (toolResponse.type === 'tool-approval-response') {
            continue;
          }
          const output = toolResponse.output;

          let contentValue: string;
          switch (output.type) {
            case 'text':
            case 'error-text':
              contentValue = output.value;
              break;
            case 'execution-denied':
              contentValue = output.reason ?? 'Tool call execution denied.';
              break;
            case 'content':
            case 'json':
            case 'error-json':
              contentValue = JSON.stringify(output.value);
              break;
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolResponse.toolCallId,
            content: contentValue,
          });
        }
        break;
      }

      default: {
        warnings.push({
          type: 'unsupported',
          feature: `message role: ${role}`,
        });
        break;
      }
    }
  }

  return { messages, warnings };
}
