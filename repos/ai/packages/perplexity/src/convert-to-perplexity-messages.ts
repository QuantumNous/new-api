import {
  UnsupportedFunctionalityError,
  type LanguageModelV4Prompt,
} from '@ai-sdk/provider';
import type {
  PerplexityMessageContent,
  PerplexityPrompt,
} from './perplexity-language-model-prompt';
import {
  convertUint8ArrayToBase64,
  getTopLevelMediaType,
  resolveFullMediaType,
} from '@ai-sdk/provider-utils';

export function convertToPerplexityMessages(
  prompt: LanguageModelV4Prompt,
): PerplexityPrompt {
  const messages: PerplexityPrompt = [];

  for (const { role, content } of prompt) {
    switch (role) {
      case 'system': {
        messages.push({ role: 'system', content });
        break;
      }

      case 'user':
      case 'assistant': {
        const hasMultipartContent = content.some(
          part =>
            (part.type === 'file' &&
              getTopLevelMediaType(part.mediaType) === 'image') ||
            (part.type === 'file' &&
              getTopLevelMediaType(part.mediaType) === 'application'),
        );

        const messageContent = content
          .map((part, index) => {
            switch (part.type) {
              case 'text': {
                return {
                  type: 'text',
                  text: part.text,
                };
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
                    if (part.mediaType === 'application/pdf') {
                      return part.data.type === 'url'
                        ? {
                            type: 'file_url',
                            file_url: {
                              url: part.data.url.toString(),
                            },
                            file_name: part.filename,
                          }
                        : {
                            type: 'file_url',
                            file_url: {
                              url:
                                typeof part.data.data === 'string'
                                  ? part.data.data
                                  : convertUint8ArrayToBase64(part.data.data),
                            },
                            file_name: part.filename || `document-${index}.pdf`,
                          };
                    } else if (
                      getTopLevelMediaType(part.mediaType) === 'image'
                    ) {
                      return part.data.type === 'url'
                        ? {
                            type: 'image_url',
                            image_url: {
                              url: part.data.url.toString(),
                            },
                          }
                        : {
                            type: 'image_url',
                            image_url: {
                              url: `data:${resolveFullMediaType({ part })};base64,${
                                typeof part.data.data === 'string'
                                  ? part.data.data
                                  : convertUint8ArrayToBase64(part.data.data)
                              }`,
                            },
                          };
                    }
                    return undefined;
                  }
                }
              }
            }
          })
          .filter(Boolean) as PerplexityMessageContent[];
        messages.push({
          role,
          content: hasMultipartContent
            ? messageContent
            : messageContent
                .filter(part => part.type === 'text')
                .map(part => part.text)
                .join(''),
        });
        break;
      }
      case 'tool': {
        throw new UnsupportedFunctionalityError({
          functionality: 'Tool messages',
        });
      }
      default: {
        const _exhaustiveCheck: never = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }

  return messages;
}
