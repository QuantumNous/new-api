import { OpenAICompatibleChatLanguageModel } from '@ai-sdk/openai-compatible';
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
} from '@ai-sdk/provider';
import {
  serializeModelOptions,
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
} from '@ai-sdk/provider-utils';
import type { CerebrasChatModelId } from './cerebras-chat-language-model-options';

type CerebrasChatConfig = ConstructorParameters<
  typeof OpenAICompatibleChatLanguageModel
>[1];

function isStructuredOutputWithToolCallsFinishReason({
  rawFinishReason,
  hasText,
  responseFormatType,
}: {
  rawFinishReason: string | undefined;
  hasText: boolean;
  responseFormatType:
    | NonNullable<LanguageModelV4CallOptions['responseFormat']>['type']
    | undefined;
}) {
  return (
    responseFormatType === 'json' && rawFinishReason === 'tool_calls' && hasText
  );
}

export class CerebrasChatLanguageModel
  extends OpenAICompatibleChatLanguageModel
  implements LanguageModelV4
{
  static [WORKFLOW_SERIALIZE](model: CerebrasChatLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: CerebrasChatModelId;
    config: CerebrasChatConfig;
  }) {
    return new CerebrasChatLanguageModel(options.modelId, options.config);
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const result = await super.doGenerate(options);

    if (
      !isStructuredOutputWithToolCallsFinishReason({
        rawFinishReason: result.finishReason.raw,
        hasText: result.content.some(
          part => part.type === 'text' && part.text.length > 0,
        ),
        responseFormatType: options.responseFormat?.type,
      })
    ) {
      return result;
    }

    return {
      ...result,
      // Cerebras GLM can return valid structured output text while also
      // repeating a tool call. Treat that mixed response as the final answer.
      content: result.content.filter(part => part.type !== 'tool-call'),
      finishReason: {
        ...result.finishReason,
        unified: 'stop',
      },
    };
  }

  async doStream(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4StreamResult> {
    const result = await super.doStream(options);
    let hasText = false;

    return {
      ...result,
      stream: result.stream.pipeThrough(
        new TransformStream<
          LanguageModelV4StreamPart,
          LanguageModelV4StreamPart
        >({
          transform(part, controller) {
            if (part.type === 'text-delta' && part.delta.length > 0) {
              hasText = true;
            }

            if (
              part.type === 'finish' &&
              isStructuredOutputWithToolCallsFinishReason({
                rawFinishReason: part.finishReason.raw,
                hasText,
                responseFormatType: options.responseFormat?.type,
              })
            ) {
              controller.enqueue({
                ...part,
                finishReason: {
                  ...part.finishReason,
                  unified: 'stop',
                },
              });
              return;
            }

            if (
              options.responseFormat?.type === 'json' &&
              hasText &&
              (part.type === 'tool-input-start' ||
                part.type === 'tool-input-delta' ||
                part.type === 'tool-input-end' ||
                part.type === 'tool-call')
            ) {
              return;
            }

            controller.enqueue(part);
          },
        }),
      ),
    };
  }
}
