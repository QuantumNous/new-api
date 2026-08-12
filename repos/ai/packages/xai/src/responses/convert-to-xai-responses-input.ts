import {
  UnsupportedFunctionalityError,
  type SharedV4Warning,
  type LanguageModelV4Message,
} from '@ai-sdk/provider';
import {
  convertToBase64,
  getTopLevelMediaType,
  resolveFullMediaType,
  resolveProviderReference,
} from '@ai-sdk/provider-utils';
import type {
  XaiResponsesInput,
  XaiResponsesUserMessageContentPart,
} from './xai-responses-api';

export async function convertToXaiResponsesInput({
  prompt,
}: {
  prompt: LanguageModelV4Message[];
  store?: boolean;
}): Promise<{
  input: XaiResponsesInput;
  inputWarnings: SharedV4Warning[];
}> {
  const input: XaiResponsesInput = [];
  const inputWarnings: SharedV4Warning[] = [];

  for (const message of prompt) {
    switch (message.role) {
      case 'system': {
        input.push({
          role: 'system',
          content: message.content,
        });
        break;
      }

      case 'user': {
        const contentParts: XaiResponsesUserMessageContentPart[] = [];

        for (const block of message.content) {
          switch (block.type) {
            case 'text': {
              contentParts.push({ type: 'input_text', text: block.text });
              break;
            }

            case 'file': {
              switch (block.data.type) {
                case 'reference': {
                  contentParts.push({
                    type: 'input_file',
                    file_id: resolveProviderReference({
                      reference: block.data.reference,
                      provider: 'xai',
                    }),
                  });
                  break;
                }
                case 'text': {
                  throw new UnsupportedFunctionalityError({
                    functionality: 'text file parts',
                  });
                }
                case 'url':
                case 'data': {
                  if (getTopLevelMediaType(block.mediaType) === 'image') {
                    const imageUrl =
                      block.data.type === 'url'
                        ? block.data.url.toString()
                        : `data:${resolveFullMediaType({ part: block })};base64,${convertToBase64(block.data.data)}`;

                    contentParts.push({
                      type: 'input_image',
                      image_url: imageUrl,
                    });
                  } else if (block.data.type === 'url') {
                    // xAI's Responses API accepts non-image documents (PDF, text, CSV, etc.)
                    // via `{ type: 'input_file', file_url }`. See
                    // https://docs.x.ai/docs/guides/chat-with-files. Inline bytes for
                    // non-image files are not supported by xAI; callers must upload via
                    // the Files API and pass a provider reference (file_id) instead.
                    contentParts.push({
                      type: 'input_file',
                      file_url: block.data.url.toString(),
                    });
                  } else {
                    throw new UnsupportedFunctionalityError({
                      functionality: `file part media type ${block.mediaType} as inline data (xAI Responses requires a URL or a Files API reference for non-image files)`,
                    });
                  }
                  break;
                }
              }
              break;
            }

            default: {
              const _exhaustiveCheck: never = block;
              inputWarnings.push({
                type: 'other',
                message:
                  'xAI Responses API does not support this content type in user messages',
              });
            }
          }
        }

        input.push({
          role: 'user',
          content: contentParts,
        });
        break;
      }

      case 'assistant': {
        for (const part of message.content) {
          switch (part.type) {
            case 'text': {
              const id =
                typeof part.providerOptions?.xai?.itemId === 'string'
                  ? part.providerOptions.xai.itemId
                  : undefined;

              input.push({
                role: 'assistant',
                content: part.text,
                id,
              });

              break;
            }

            case 'tool-call': {
              if (part.providerExecuted) {
                break;
              }

              const id =
                typeof part.providerOptions?.xai?.itemId === 'string'
                  ? part.providerOptions.xai.itemId
                  : undefined;

              input.push({
                type: 'function_call',
                id: id ?? part.toolCallId,
                call_id: part.toolCallId,
                name: part.toolName,
                arguments: JSON.stringify(part.input),
                status: 'completed',
              });
              break;
            }

            case 'tool-result': {
              break;
            }

            case 'reasoning': {
              const itemId =
                typeof part.providerOptions?.xai?.itemId === 'string'
                  ? part.providerOptions.xai.itemId
                  : undefined;
              const encryptedContent =
                typeof part.providerOptions?.xai?.reasoningEncryptedContent ===
                'string'
                  ? part.providerOptions.xai.reasoningEncryptedContent
                  : undefined;

              if (itemId != null || encryptedContent != null) {
                const summaryParts: Array<{
                  type: 'summary_text';
                  text: string;
                }> = [];
                if (part.text.length > 0) {
                  summaryParts.push({
                    type: 'summary_text',
                    text: part.text,
                  });
                }

                input.push({
                  type: 'reasoning',
                  id: itemId ?? '',
                  summary: summaryParts,
                  status: 'completed',
                  ...(encryptedContent != null && {
                    encrypted_content: encryptedContent,
                  }),
                });
              } else {
                inputWarnings.push({
                  type: 'other',
                  message:
                    'Reasoning parts without itemId or encrypted content cannot be sent back to xAI. Skipping.',
                });
              }
              break;
            }

            case 'reasoning-file':
            case 'custom':
            case 'file': {
              inputWarnings.push({
                type: 'other',
                message: `xAI Responses API does not support ${part.type} in assistant messages`,
              });
              break;
            }

            default: {
              const _exhaustiveCheck: never = part;
              inputWarnings.push({
                type: 'other',
                message:
                  'xAI Responses API does not support this content type in assistant messages',
              });
            }
          }
        }

        break;
      }

      case 'tool': {
        for (const part of message.content) {
          if (part.type === 'tool-approval-response') {
            continue;
          }
          const output = part.output;

          let outputValue: string;
          switch (output.type) {
            case 'text':
            case 'error-text':
              outputValue = output.value;
              break;
            case 'execution-denied':
              outputValue = output.reason ?? 'tool execution denied';
              break;
            case 'json':
            case 'error-json':
              outputValue = JSON.stringify(output.value);
              break;
            case 'content':
              outputValue = output.value
                .map(item => {
                  if (item.type === 'text') {
                    return item.text;
                  }
                  return '';
                })
                .join('');
              break;
            default: {
              const _exhaustiveCheck: never = output;
              outputValue = '';
            }
          }

          input.push({
            type: 'function_call_output',
            call_id: part.toolCallId,
            output: outputValue,
          });
        }

        break;
      }

      default: {
        const _exhaustiveCheck: never = message;
        inputWarnings.push({
          type: 'other',
          message: 'unsupported message role',
        });
      }
    }
  }

  return { input, inputWarnings };
}
