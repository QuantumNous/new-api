import {
  UnsupportedFunctionalityError,
  type LanguageModelV4Prompt,
  type LanguageModelV4ToolResultOutput,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  convertToBase64,
  getTopLevelMediaType,
  isFullMediaType,
  resolveFullMediaType,
  resolveProviderReference,
  secureJsonParse,
} from '@ai-sdk/provider-utils';
import type {
  GoogleContent,
  GoogleContentPart,
  GoogleFunctionResponsePart,
  GooglePrompt,
} from './google-prompt';

/**
 * Sentinel value Google documents for replaying functionCall parts whose
 * original thoughtSignature is not available to the client.
 *
 * See https://ai.google.dev/gemini-api/docs/thought-signatures.
 */
export const SKIP_THOUGHT_SIGNATURE_VALIDATOR =
  'skip_thought_signature_validator';

const dataUrlRegex = /^data:([^;,]+);base64,(.+)$/s;

function parseBase64DataUrl(
  value: string,
): { mediaType: string; data: string } | undefined {
  const match = dataUrlRegex.exec(value);
  if (match == null) {
    return undefined;
  }

  return {
    mediaType: match[1],
    data: match[2],
  };
}

function convertUrlToolResultPart(
  url: string,
): GoogleFunctionResponsePart | undefined {
  // Per https://ai.google.dev/api/caching#FunctionResponsePart, only inline data is supported.
  // https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/function-calling#functionresponsepart suggests that this
  // may be different for Vertex, but this needs to be confirmed and further tested for both APIs.
  const parsedDataUrl = parseBase64DataUrl(url);
  if (parsedDataUrl == null) {
    return undefined;
  }

  return {
    inlineData: {
      mimeType: parsedDataUrl.mediaType,
      data: parsedDataUrl.data,
    },
  };
}

/*
 * Appends tool result content parts to the message using the functionResponse
 * format with support for multimodal parts (e.g. inline images/files alongside
 * text). This format is supported by Gemini 3+ models.
 */
function appendToolResultParts(
  parts: GoogleContentPart[],
  toolName: string,
  outputValue: Extract<
    LanguageModelV4ToolResultOutput,
    { type: 'content' }
  >['value'],
  toolCallId?: string,
): void {
  const functionResponseParts: GoogleFunctionResponsePart[] = [];
  const responseTextParts: string[] = [];

  for (const contentPart of outputValue) {
    switch (contentPart.type) {
      case 'text': {
        responseTextParts.push(contentPart.text);
        break;
      }
      case 'file': {
        if (contentPart.data.type === 'data') {
          functionResponseParts.push({
            inlineData: {
              mimeType: resolveFullMediaType({ part: contentPart }),
              data: convertToBase64(contentPart.data.data),
            },
          });
        } else if (contentPart.data.type === 'url') {
          const functionResponsePart = convertUrlToolResultPart(
            contentPart.data.url.toString(),
          );

          if (functionResponsePart != null) {
            functionResponseParts.push(functionResponsePart);
          } else {
            responseTextParts.push(JSON.stringify(contentPart));
          }
        } else {
          responseTextParts.push(JSON.stringify(contentPart));
        }
        break;
      }
      default: {
        responseTextParts.push(JSON.stringify(contentPart));
        break;
      }
    }
  }

  parts.push({
    functionResponse: {
      ...(toolCallId != null ? { id: toolCallId } : {}),
      name: toolName,
      response: {
        name: toolName,
        content:
          responseTextParts.length > 0
            ? responseTextParts.join('\n')
            : 'Tool executed successfully.',
      },
      ...(functionResponseParts.length > 0
        ? { parts: functionResponseParts }
        : {}),
    },
  });
}

/*
 * Appends tool result content parts using a legacy format for pre-Gemini 3
 * models that do not support multimodal parts within functionResponse. Instead,
 * non-text content like images is sent as separate top-level inlineData parts.
 */
function appendLegacyToolResultParts(
  parts: GoogleContentPart[],
  toolName: string,
  outputValue: Extract<
    LanguageModelV4ToolResultOutput,
    { type: 'content' }
  >['value'],
  toolCallId?: string,
): void {
  for (const contentPart of outputValue) {
    switch (contentPart.type) {
      case 'text':
        parts.push({
          functionResponse: {
            ...(toolCallId != null ? { id: toolCallId } : {}),
            name: toolName,
            response: {
              name: toolName,
              content: contentPart.text,
            },
          },
        });
        break;
      case 'file': {
        if (contentPart.data.type === 'data') {
          const topLevelMediaType = getTopLevelMediaType(contentPart.mediaType);

          parts.push(
            {
              inlineData: {
                mimeType: resolveFullMediaType({ part: contentPart }),
                data: convertToBase64(contentPart.data.data),
              },
            },
            {
              text:
                `Tool executed successfully and returned this ` +
                `${topLevelMediaType === 'image' ? 'image' : 'file'} ` +
                `as a response`,
            },
          );
        } else {
          parts.push({ text: JSON.stringify(contentPart) });
        }
        break;
      }
      default:
        parts.push({ text: JSON.stringify(contentPart) });
        break;
    }
  }
}

export function convertToGoogleMessages(
  prompt: LanguageModelV4Prompt,
  options?: {
    isGemmaModel?: boolean;
    isGemini3Model?: boolean;
    onWarning?: (warning: SharedV4Warning) => void;
    /**
     * Names to look up under `providerOptions` when reading per-part metadata
     * (e.g. thought signatures). Tried in order; first match wins. For the
     * Vertex provider this is `['googleVertex', 'vertex']` (new key first,
     * legacy key as fallback) and for the Google provider it is `['google']`.
     */
    providerOptionsNames?: readonly string[];
    supportsFunctionResponseParts?: boolean;
  },
): GooglePrompt {
  const systemInstructionParts: Array<{ text: string }> = [];
  const contents: Array<GoogleContent> = [];
  let systemMessagesAllowed = true;
  const isGemmaModel = options?.isGemmaModel ?? false;
  const isGemini3Model = options?.isGemini3Model ?? false;
  const onWarning = options?.onWarning;
  const providerOptionsNames = options?.providerOptionsNames ?? ['google'];
  const isVertexLike = !providerOptionsNames.includes('google');
  const supportsFunctionResponseParts =
    options?.supportsFunctionResponseParts ?? true;

  let sentinelInjected = false;
  const missingSignatureToolNames: string[] = [];
  const injectSkipSignature = (toolName: string) => {
    missingSignatureToolNames.push(toolName);
    sentinelInjected = true;
    return SKIP_THOUGHT_SIGNATURE_VALIDATOR;
  };

  const readProviderOpts = (part: {
    providerOptions?: Record<string, unknown> | undefined;
  }): Record<string, unknown> | undefined => {
    for (const name of providerOptionsNames) {
      const v = part.providerOptions?.[name];
      if (v != null) return v as Record<string, unknown>;
    }
    // Cross-namespace fallback (gateway interop): Vertex providers may receive
    // metadata under `google`, and the Google provider may receive metadata
    // under `googleVertex`/`vertex`.
    if (isVertexLike) {
      return part.providerOptions?.google as
        | Record<string, unknown>
        | undefined;
    }
    return (part.providerOptions?.googleVertex ??
      part.providerOptions?.vertex) as Record<string, unknown> | undefined;
  };

  for (const { role, content } of prompt) {
    switch (role) {
      case 'system': {
        if (!systemMessagesAllowed) {
          throw new UnsupportedFunctionalityError({
            functionality:
              'system messages are only supported at the beginning of the conversation',
          });
        }

        systemInstructionParts.push({ text: content });
        break;
      }

      case 'user': {
        systemMessagesAllowed = false;

        const parts: GoogleContentPart[] = [];

        for (const part of content) {
          switch (part.type) {
            case 'text': {
              parts.push({ text: part.text });
              break;
            }

            case 'file': {
              switch (part.data.type) {
                case 'url': {
                  parts.push({
                    fileData: {
                      mimeType: resolveFullMediaType({ part }),
                      fileUri: part.data.url.toString(),
                    },
                  });
                  break;
                }
                case 'reference': {
                  if (isVertexLike) {
                    throw new UnsupportedFunctionalityError({
                      functionality: 'file parts with provider references',
                    });
                  }

                  parts.push({
                    fileData: {
                      mimeType: resolveFullMediaType({ part }),
                      fileUri: resolveProviderReference({
                        reference: part.data.reference,
                        provider: 'google',
                      }),
                    },
                  });
                  break;
                }
                case 'text': {
                  parts.push({
                    inlineData: {
                      mimeType: isFullMediaType(part.mediaType)
                        ? part.mediaType
                        : 'text/plain',
                      data: convertToBase64(
                        new TextEncoder().encode(part.data.text),
                      ),
                    },
                  });
                  break;
                }
                case 'data': {
                  parts.push({
                    inlineData: {
                      mimeType: resolveFullMediaType({ part }),
                      data: convertToBase64(part.data.data),
                    },
                  });
                  break;
                }
              }

              break;
            }
          }
        }

        contents.push({ role: 'user', parts });
        break;
      }

      case 'assistant': {
        systemMessagesAllowed = false;

        contents.push({
          role: 'model',
          parts: content
            .map(part => {
              const providerOpts = readProviderOpts(part);
              const thoughtSignature =
                providerOpts?.thoughtSignature != null
                  ? String(providerOpts.thoughtSignature)
                  : undefined;

              switch (part.type) {
                case 'text': {
                  return part.text.length === 0
                    ? undefined
                    : {
                        text: part.text,
                        thoughtSignature,
                      };
                }

                case 'reasoning': {
                  return part.text.length === 0
                    ? undefined
                    : {
                        text: part.text,
                        thought: true,
                        thoughtSignature,
                      };
                }

                case 'reasoning-file': {
                  switch (part.data.type) {
                    case 'url': {
                      throw new UnsupportedFunctionalityError({
                        functionality:
                          'File data URLs in assistant messages are not supported',
                      });
                    }
                    case 'data': {
                      return {
                        inlineData: {
                          mimeType: part.mediaType,
                          data: convertToBase64(part.data.data),
                        },
                        thought: true,
                        thoughtSignature,
                      };
                    }
                  }
                  break;
                }

                case 'file': {
                  switch (part.data.type) {
                    case 'url': {
                      throw new UnsupportedFunctionalityError({
                        functionality:
                          'File data URLs in assistant messages are not supported',
                      });
                    }
                    case 'reference': {
                      if (isVertexLike) {
                        throw new UnsupportedFunctionalityError({
                          functionality: 'file parts with provider references',
                        });
                      }

                      return {
                        fileData: {
                          mimeType: part.mediaType,
                          fileUri: resolveProviderReference({
                            reference: part.data.reference,
                            provider: 'google',
                          }),
                        },
                        ...(providerOpts?.thought === true
                          ? { thought: true }
                          : {}),
                        thoughtSignature,
                      };
                    }
                    case 'text': {
                      return {
                        inlineData: {
                          mimeType: isFullMediaType(part.mediaType)
                            ? part.mediaType
                            : 'text/plain',
                          data: convertToBase64(
                            new TextEncoder().encode(part.data.text),
                          ),
                        },
                        ...(providerOpts?.thought === true
                          ? { thought: true }
                          : {}),
                        thoughtSignature,
                      };
                    }
                    case 'data': {
                      return {
                        inlineData: {
                          mimeType: part.mediaType,
                          data: convertToBase64(part.data.data),
                        },
                        ...(providerOpts?.thought === true
                          ? { thought: true }
                          : {}),
                        thoughtSignature,
                      };
                    }
                  }
                  break;
                }

                case 'tool-call': {
                  const serverToolCallId =
                    providerOpts?.serverToolCallId != null
                      ? String(providerOpts.serverToolCallId)
                      : undefined;
                  const serverToolType =
                    providerOpts?.serverToolType != null
                      ? String(providerOpts.serverToolType)
                      : undefined;
                  const effectiveThoughtSignature =
                    thoughtSignature ??
                    (isGemini3Model
                      ? injectSkipSignature(part.toolName)
                      : undefined);

                  if (serverToolCallId && serverToolType) {
                    return {
                      toolCall: {
                        toolType: serverToolType,
                        args:
                          typeof part.input === 'string'
                            ? secureJsonParse(part.input)
                            : part.input,
                        id: serverToolCallId,
                      },
                      thoughtSignature: effectiveThoughtSignature,
                    };
                  }

                  return {
                    functionCall: {
                      ...(part.toolCallId != null
                        ? { id: part.toolCallId }
                        : {}),
                      name: part.toolName,
                      args: part.input,
                    },
                    thoughtSignature: effectiveThoughtSignature,
                  };
                }

                case 'tool-result': {
                  const serverToolCallId =
                    providerOpts?.serverToolCallId != null
                      ? String(providerOpts.serverToolCallId)
                      : undefined;
                  const serverToolType =
                    providerOpts?.serverToolType != null
                      ? String(providerOpts.serverToolType)
                      : undefined;

                  if (serverToolCallId && serverToolType) {
                    return {
                      toolResponse: {
                        toolType: serverToolType,
                        response:
                          part.output.type === 'json' ? part.output.value : {},
                        id: serverToolCallId,
                      },
                      thoughtSignature,
                    };
                  }

                  return undefined;
                }
              }
            })
            .filter(part => part !== undefined),
        });

        break;
      }

      case 'tool': {
        systemMessagesAllowed = false;

        const parts: GoogleContentPart[] = [];

        for (const part of content) {
          if (part.type === 'tool-approval-response') {
            continue;
          }

          const partProviderOpts = readProviderOpts(part);
          const serverToolCallId =
            partProviderOpts?.serverToolCallId != null
              ? String(partProviderOpts.serverToolCallId)
              : undefined;
          const serverToolType =
            partProviderOpts?.serverToolType != null
              ? String(partProviderOpts.serverToolType)
              : undefined;

          if (serverToolCallId && serverToolType) {
            const serverThoughtSignature =
              partProviderOpts?.thoughtSignature != null
                ? String(partProviderOpts.thoughtSignature)
                : undefined;

            if (contents.length > 0) {
              const lastContent = contents[contents.length - 1];
              if (lastContent.role === 'model') {
                lastContent.parts.push({
                  toolResponse: {
                    toolType: serverToolType,
                    response:
                      part.output.type === 'json' ? part.output.value : {},
                    id: serverToolCallId,
                  },
                  thoughtSignature: serverThoughtSignature,
                });
                continue;
              }
            }
          }

          const output = part.output;

          if (output.type === 'content') {
            if (supportsFunctionResponseParts) {
              appendToolResultParts(
                parts,
                part.toolName,
                output.value,
                part.toolCallId,
              );
            } else {
              appendLegacyToolResultParts(
                parts,
                part.toolName,
                output.value,
                part.toolCallId,
              );
            }
          } else {
            parts.push({
              functionResponse: {
                ...(part.toolCallId != null ? { id: part.toolCallId } : {}),
                name: part.toolName,
                response: {
                  name: part.toolName,
                  content:
                    output.type === 'execution-denied'
                      ? (output.reason ?? 'Tool call execution denied.')
                      : output.value,
                },
              },
            });
          }
        }

        contents.push({
          role: 'user',
          parts,
        });
        break;
      }
    }
  }

  if (
    isGemmaModel &&
    systemInstructionParts.length > 0 &&
    contents.length > 0 &&
    contents[0].role === 'user'
  ) {
    const systemText = systemInstructionParts
      .map(part => part.text)
      .join('\n\n');

    contents[0].parts.unshift({ text: systemText + '\n\n' });
  }

  if (sentinelInjected && onWarning != null) {
    const uniqueToolNames = Array.from(new Set(missingSignatureToolNames));
    onWarning({
      type: 'other',
      message:
        `Replayed ${missingSignatureToolNames.length} \`functionCall\` part(s) ` +
        `for a Gemini 3 model without a \`thoughtSignature\` ` +
        `(tools: ${uniqueToolNames.map(name => `\`${name}\``).join(', ')}). ` +
        `Injected the documented \`skip_thought_signature_validator\` sentinel ` +
        `to keep the request from failing with HTTP 400. ` +
        `The likely cause is application code that drops ` +
        '`providerOptions.google.thoughtSignature` when persisting or ' +
        'serializing assistant tool-call messages. ' +
        'See https://ai.google.dev/gemini-api/docs/thought-signatures.',
    });
  }

  return {
    systemInstruction:
      systemInstructionParts.length > 0 && !isGemmaModel
        ? { parts: systemInstructionParts }
        : undefined,
    contents,
  };
}
