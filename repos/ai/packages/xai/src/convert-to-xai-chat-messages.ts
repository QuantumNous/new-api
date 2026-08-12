import {
  UnsupportedFunctionalityError,
  type SharedV4Warning,
  type LanguageModelV4Prompt,
} from '@ai-sdk/provider';
import {
  convertToBase64,
  getTopLevelMediaType,
  resolveFullMediaType,
  resolveProviderReference,
} from '@ai-sdk/provider-utils';
import type { XaiChatPrompt } from './xai-chat-prompt';

export function convertToXaiChatMessages(prompt: LanguageModelV4Prompt): {
  messages: XaiChatPrompt;
  warnings: Array<SharedV4Warning>;
} {
  const messages: XaiChatPrompt = [];
  const warnings: Array<SharedV4Warning> = [];

  for (const { role, content } of prompt) {
    switch (role) {
      case 'system': {
        messages.push({ role: 'system', content });
        break;
      }

      case 'user': {
        if (content.length === 1 && content[0].type === 'text') {
          messages.push({ role: 'user', content: content[0].text });
          break;
        }

        messages.push({
          role: 'user',
          content: content.map(part => {
            switch (part.type) {
              case 'text': {
                return { type: 'text', text: part.text };
              }
              case 'file': {
                switch (part.data.type) {
                  case 'reference': {
                    return {
                      type: 'file',
                      file: {
                        file_id: resolveProviderReference({
                          reference: part.data.reference,
                          provider: 'xai',
                        }),
                      },
                    };
                  }
                  case 'text': {
                    throw new UnsupportedFunctionalityError({
                      functionality: 'text file parts',
                    });
                  }
                  case 'url':
                  case 'data': {
                    if (getTopLevelMediaType(part.mediaType) === 'image') {
                      return {
                        type: 'image_url',
                        image_url: {
                          url:
                            part.data.type === 'url'
                              ? part.data.url.toString()
                              : `data:${resolveFullMediaType({ part })};base64,${convertToBase64(part.data.data)}`,
                        },
                      };
                    } else {
                      throw new UnsupportedFunctionalityError({
                        functionality: `file part media type ${part.mediaType}`,
                      });
                    }
                  }
                }
              }
            }
          }),
        });

        break;
      }

      case 'assistant': {
        let text = '';
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

        messages.push({
          role: 'assistant',
          content: text,
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
        const _exhaustiveCheck: never = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }

  return { messages, warnings };
}
