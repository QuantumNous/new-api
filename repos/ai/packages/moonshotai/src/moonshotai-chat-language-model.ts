import { OpenAICompatibleChatLanguageModel } from '@ai-sdk/openai-compatible';
import type { OpenAICompatibleChatConfig } from '@ai-sdk/openai-compatible/internal';
import {
  serializeModelOptions,
  WORKFLOW_SERIALIZE,
  WORKFLOW_DESERIALIZE,
} from '@ai-sdk/provider-utils';
import type {
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
} from '@ai-sdk/provider';
import { convertMoonshotAIChatUsage } from './convert-moonshotai-chat-usage';
import type { MoonshotAIChatModelId } from './moonshotai-chat-options';

export class MoonshotAIChatLanguageModel extends OpenAICompatibleChatLanguageModel {
  static [WORKFLOW_SERIALIZE](model: MoonshotAIChatLanguageModel) {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    });
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: MoonshotAIChatModelId;
    config: OpenAICompatibleChatConfig;
  }) {
    return new MoonshotAIChatLanguageModel(options.modelId, options.config);
  }

  constructor(
    modelId: MoonshotAIChatModelId,
    config: OpenAICompatibleChatConfig,
  ) {
    super(modelId, config);
  }

  async doGenerate(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4GenerateResult> {
    const result = await super.doGenerate(options);

    // @ts-expect-error accessing response body from parent result
    const usage = result.response?.body?.usage;

    return {
      ...result,
      usage: convertMoonshotAIChatUsage(usage),
    };
  }

  async doStream(
    options: LanguageModelV4CallOptions,
  ): Promise<LanguageModelV4StreamResult> {
    const result = await super.doStream(options);

    return {
      ...result,
      stream: result.stream.pipeThrough(
        new TransformStream<
          LanguageModelV4StreamPart,
          LanguageModelV4StreamPart
        >({
          transform(chunk, controller) {
            if (chunk.type === 'finish' && chunk.usage) {
              controller.enqueue({
                ...chunk,
                usage: convertMoonshotAIChatUsage(chunk.usage.raw as any),
              });
            } else {
              controller.enqueue(chunk);
            }
          },
        }),
      ),
    };
  }
}
