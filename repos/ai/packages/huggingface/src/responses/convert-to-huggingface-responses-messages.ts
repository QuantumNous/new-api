import {
  UnsupportedFunctionalityError,
  type SharedV4Warning,
  type LanguageModelV4Prompt,
} from '@ai-sdk/provider';
import {
  getTopLevelMediaType,
  resolveFullMediaType,
} from '@ai-sdk/provider-utils';

export async function convertToHuggingFaceResponsesMessages({
  prompt,
}: {
  prompt: LanguageModelV4Prompt;
}): Promise<{
  input: string | Array<any>;
  warnings: Array<SharedV4Warning>;
}> {
  const messages: Array<any> = [];
  const warnings: Array<SharedV4Warning> = [];

  for (const { role, content } of prompt) {
    switch (role) {
      case 'system': {
        messages.push({ role: 'system', content });
        break;
      }

      case 'user': {
        messages.push({
          role: 'user',
          content: content.map(part => {
            switch (part.type) {
              case 'text': {
                return { type: 'input_text', text: part.text };
              }
              case 'file': {
                switch (part.data.type) {
                  case 'reference': {
                    throw new UnsupportedFunctionalityError({
                      functionality: 'file parts with provider references',
                    });
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
                        type: 'input_image',
                        image_url:
                          part.data.type === 'url'
                            ? part.data.url.toString()
                            : `data:${resolveFullMediaType({ part })};base64,${part.data.data}`,
                      };
                    } else {
                      throw new UnsupportedFunctionalityError({
                        functionality: `file part media type ${part.mediaType}`,
                      });
                    }
                  }
                }
              }
              default: {
                const _exhaustiveCheck: never = part;
                throw new Error(`Unsupported part type: ${_exhaustiveCheck}`);
              }
            }
          }),
        });

        break;
      }

      case 'assistant': {
        for (const part of content) {
          switch (part.type) {
            case 'text': {
              messages.push({
                role: 'assistant',
                content: [{ type: 'output_text', text: part.text }],
              });
              break;
            }
            case 'tool-call': {
              // tool calls are handled by the responses API
              break;
            }

            case 'tool-result': {
              // tool results are handled by the responses API
              break;
            }

            case 'reasoning': {
              // include reasoning content in the message text
              messages.push({
                role: 'assistant',
                content: [{ type: 'output_text', text: part.text }],
              });
              break;
            }
          }
        }

        break;
      }

      case 'tool': {
        warnings.push({ type: 'unsupported', feature: 'tool messages' });
        break;
      }

      default: {
        const _exhaustiveCheck: never = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }

  return { input: messages, warnings };
}
