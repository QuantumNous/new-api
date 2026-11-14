import {
  UnsupportedFunctionalityError,
  type LanguageModelV4Prompt,
  type SharedV4Warning,
} from '@ai-sdk/provider';
import {
  convertToBase64,
  getTopLevelMediaType,
  resolveFullMediaType,
} from '@ai-sdk/provider-utils';
import type {
  FunctionCallItemParam,
  FunctionCallOutputItemParam,
  InputFileContentParam,
  InputImageContentParam,
  InputTextContentParam,
  OpenResponsesRequestBody,
  OutputTextContentParam,
  RefusalContentParam,
} from './open-responses-api';

export async function convertToOpenResponsesInput({
  prompt,
}: {
  prompt: LanguageModelV4Prompt;
}): Promise<{
  input: OpenResponsesRequestBody['input'];
  instructions: string | undefined;
  warnings: Array<SharedV4Warning>;
}> {
  const input: OpenResponsesRequestBody['input'] = [];
  const warnings: Array<SharedV4Warning> = [];
  const systemMessages: string[] = [];

  for (const { role, content } of prompt) {
    switch (role) {
      case 'system': {
        systemMessages.push(content);
        break;
      }

      case 'user': {
        const userContent: Array<
          InputTextContentParam | InputImageContentParam | InputFileContentParam
        > = [];

        for (const part of content) {
          switch (part.type) {
            case 'text': {
              userContent.push({ type: 'input_text', text: part.text });
              break;
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
                  const topLevel = getTopLevelMediaType(part.mediaType);

                  if (topLevel === 'image') {
                    userContent.push({
                      type: 'input_image',
                      ...(part.data.type === 'url'
                        ? { image_url: part.data.url.toString() }
                        : {
                            image_url: `data:${resolveFullMediaType({ part })};base64,${convertToBase64(part.data.data)}`,
                          }),
                    });
                  } else if (part.data.type === 'url') {
                    userContent.push({
                      type: 'input_file',
                      file_url: part.data.url.toString(),
                    });
                  } else {
                    const fullMediaType = resolveFullMediaType({ part });
                    userContent.push({
                      type: 'input_file',
                      filename: part.filename ?? 'data',
                      file_data: `data:${fullMediaType};base64,${convertToBase64(part.data.data)}`,
                    });
                  }

                  break;
                }
              }
              break;
            }
          }
        }

        input.push({ type: 'message', role: 'user', content: userContent });
        break;
      }

      case 'assistant': {
        const assistantContent: Array<
          OutputTextContentParam | RefusalContentParam
        > = [];
        const toolCalls: Array<FunctionCallItemParam> = [];

        for (const part of content) {
          switch (part.type) {
            case 'text': {
              assistantContent.push({ type: 'output_text', text: part.text });
              break;
            }
            case 'tool-call': {
              const argumentsValue =
                typeof part.input === 'string'
                  ? part.input
                  : JSON.stringify(part.input);
              toolCalls.push({
                type: 'function_call',
                call_id: part.toolCallId,
                name: part.toolName,
                arguments: argumentsValue,
              });
              break;
            }
          }
        }

        // Push assistant message with text content if any
        if (assistantContent.length > 0) {
          input.push({
            type: 'message',
            role: 'assistant',
            content: assistantContent,
          });
        }

        // Push function calls as separate items
        for (const toolCall of toolCalls) {
          input.push(toolCall);
        }

        break;
      }

      case 'tool': {
        for (const part of content) {
          if (part.type === 'tool-result') {
            const output = part.output;
            let contentValue: FunctionCallOutputItemParam['output'];

            switch (output.type) {
              case 'text':
              case 'error-text':
                contentValue = output.value;
                break;
              case 'execution-denied':
                contentValue = output.reason ?? 'Tool call execution denied.';
                break;
              case 'json':
              case 'error-json':
                contentValue = JSON.stringify(output.value);
                break;
              case 'content': {
                const contentParts: Array<
                  | InputTextContentParam
                  | InputImageContentParam
                  | InputFileContentParam
                > = [];
                for (const item of output.value) {
                  switch (item.type) {
                    case 'text': {
                      contentParts.push({
                        type: 'input_text',
                        text: item.text,
                      });
                      break;
                    }
                    case 'file': {
                      const topLevel = getTopLevelMediaType(item.mediaType);

                      if (item.data.type === 'data') {
                        const fullMediaType = resolveFullMediaType({
                          part: item,
                        });
                        if (topLevel === 'image') {
                          contentParts.push({
                            type: 'input_image',
                            image_url: `data:${fullMediaType};base64,${convertToBase64(item.data.data)}`,
                          });
                        } else {
                          contentParts.push({
                            type: 'input_file',
                            filename: item.filename ?? 'data',
                            file_data: `data:${fullMediaType};base64,${convertToBase64(item.data.data)}`,
                          });
                        }
                      } else if (item.data.type === 'url') {
                        if (topLevel === 'image') {
                          contentParts.push({
                            type: 'input_image',
                            image_url: item.data.url.toString(),
                          });
                        } else {
                          contentParts.push({
                            type: 'input_file',
                            file_url: item.data.url.toString(),
                          });
                        }
                      } else {
                        warnings.push({
                          type: 'other',
                          message: `unsupported tool content part type: ${item.type} with data type: ${item.data.type}`,
                        });
                      }
                      break;
                    }
                    default: {
                      warnings.push({
                        type: 'other',
                        message: `unsupported tool content part type: ${(item as { type: string }).type}`,
                      });
                      break;
                    }
                  }
                }
                contentValue = contentParts;
                break;
              }
            }

            input.push({
              type: 'function_call_output',
              call_id: part.toolCallId,
              output: contentValue,
            });
          }
        }
        break;
      }
    }
  }

  return {
    input,
    instructions:
      systemMessages.length > 0 ? systemMessages.join('\n') : undefined,
    warnings,
  };
}
