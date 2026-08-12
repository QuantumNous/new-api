import type {
  AlibabaLanguageModelOptions,
  AlibabaProviderOptions,
  AlibabaVideoModelOptions,
  AlibabaVideoProviderOptions,
} from '@ai-sdk/alibaba';
import type {
  AmazonBedrockLanguageModelOptions,
  AmazonBedrockRerankingModelOptions,
  BedrockProviderOptions,
  BedrockRerankingOptions,
} from '@ai-sdk/amazon-bedrock';
import type {
  AnthropicLanguageModelOptions,
  AnthropicProviderOptions,
} from '@ai-sdk/anthropic';
import type {
  OpenAIChatLanguageModelOptions as AzureOpenAIChatLanguageModelOptions,
  OpenAILanguageModelChatOptions as AzureOpenAILanguageModelChatOptions,
  OpenAILanguageModelResponsesOptions as AzureOpenAILanguageModelResponsesOptions,
  OpenAIResponsesProviderOptions as AzureOpenAIResponsesProviderOptions,
} from '@ai-sdk/azure';
import type {
  BlackForestLabsImageModelOptions,
  BlackForestLabsImageProviderOptions,
} from '@ai-sdk/black-forest-labs';
import type {
  CohereChatModelOptions,
  CohereLanguageModelOptions,
  CohereRerankingModelOptions,
  CohereRerankingOptions,
} from '@ai-sdk/cohere';
import type {
  DeepgramSpeechCallOptions,
  DeepgramSpeechModelOptions,
} from '@ai-sdk/deepgram';
import type {
  DeepSeekChatOptions,
  DeepSeekLanguageModelOptions,
} from '@ai-sdk/deepseek';
import type {
  FalImageModelOptions,
  FalImageProviderOptions,
  FalVideoModelOptions,
  FalVideoProviderOptions,
} from '@ai-sdk/fal';
import type {
  FireworksEmbeddingModelOptions,
  FireworksEmbeddingProviderOptions,
  FireworksLanguageModelOptions,
  FireworksProviderOptions,
} from '@ai-sdk/fireworks';
import type {
  GatewayLanguageModelOptions,
  GatewayProviderOptions,
} from '@ai-sdk/gateway';
import type {
  GoogleEmbeddingModelOptions,
  GoogleGenerativeAIEmbeddingProviderOptions,
  GoogleGenerativeAIImageProviderOptions,
  GoogleGenerativeAIProviderOptions,
  GoogleGenerativeAIVideoProviderOptions,
  GoogleImageModelOptions,
  GoogleLanguageModelOptions,
  GoogleVideoModelOptions,
  GoogleProvider,
  GoogleGenerativeAIProvider,
  GoogleProviderSettings,
  GoogleGenerativeAIProviderSettings,
  GoogleProviderMetadata,
  GoogleGenerativeAIProviderMetadata,
  GoogleVideoModelId,
  GoogleGenerativeAIVideoModelId,
} from '@ai-sdk/google';
import type {
  GoogleVertexImageModelOptions,
  GoogleVertexImageProviderOptions,
  GoogleVertexVideoModelOptions,
  GoogleVertexVideoProviderOptions,
} from '@ai-sdk/google-vertex';
import type {
  GroqLanguageModelOptions,
  GroqProviderOptions,
} from '@ai-sdk/groq';
import type {
  KlingAIVideoModelOptions,
  KlingAIVideoProviderOptions,
} from '@ai-sdk/klingai';
import type {
  LumaImageModelOptions,
  LumaImageProviderOptions,
} from '@ai-sdk/luma';
import type {
  MoonshotAILanguageModelOptions,
  MoonshotAIProviderOptions,
} from '@ai-sdk/moonshotai';
import type {
  OpenAIChatLanguageModelOptions,
  OpenAILanguageModelChatOptions,
  OpenAILanguageModelResponsesOptions,
  OpenAIResponsesProviderOptions,
} from '@ai-sdk/openai';
import type {
  OpenAICompatibleCompletionProviderOptions,
  OpenAICompatibleEmbeddingModelOptions,
  OpenAICompatibleEmbeddingProviderOptions,
  OpenAICompatibleLanguageModelChatOptions,
  OpenAICompatibleLanguageModelCompletionOptions,
  OpenAICompatibleProviderOptions,
} from '@ai-sdk/openai-compatible';
import type {
  ProdiaImageModelOptions,
  ProdiaImageProviderOptions,
} from '@ai-sdk/prodia';
import type {
  ReplicateImageModelOptions,
  ReplicateImageProviderOptions,
  ReplicateVideoModelOptions,
  ReplicateVideoProviderOptions,
} from '@ai-sdk/replicate';
import type {
  TogetherAIImageModelOptions,
  TogetherAIImageProviderOptions,
  TogetherAIRerankingModelOptions,
  TogetherAIRerankingOptions,
} from '@ai-sdk/togetherai';
import type {
  XaiImageModelOptions,
  XaiImageProviderOptions,
  XaiLanguageModelChatOptions,
  XaiLanguageModelResponsesOptions,
  XaiProviderOptions,
  XaiResponsesProviderOptions,
} from '@ai-sdk/xai';
import { describe, expectTypeOf, it } from 'vitest';

describe('deprecated provider options type aliases', () => {
  describe('@ai-sdk/alibaba', () => {
    it('AlibabaProviderOptions equals AlibabaLanguageModelOptions', () => {
      expectTypeOf<AlibabaProviderOptions>().toEqualTypeOf<AlibabaLanguageModelOptions>();
    });
    it('AlibabaVideoProviderOptions equals AlibabaVideoModelOptions', () => {
      expectTypeOf<AlibabaVideoProviderOptions>().toEqualTypeOf<AlibabaVideoModelOptions>();
    });
  });

  describe('@ai-sdk/amazon-bedrock', () => {
    it('BedrockProviderOptions equals AmazonBedrockLanguageModelOptions', () => {
      expectTypeOf<BedrockProviderOptions>().toEqualTypeOf<AmazonBedrockLanguageModelOptions>();
    });
    it('BedrockRerankingOptions equals AmazonBedrockRerankingModelOptions', () => {
      expectTypeOf<BedrockRerankingOptions>().toEqualTypeOf<AmazonBedrockRerankingModelOptions>();
    });
  });

  describe('@ai-sdk/anthropic', () => {
    it('AnthropicProviderOptions equals AnthropicLanguageModelOptions', () => {
      expectTypeOf<AnthropicProviderOptions>().toEqualTypeOf<AnthropicLanguageModelOptions>();
    });
  });

  describe('@ai-sdk/azure', () => {
    it('OpenAIResponsesProviderOptions equals OpenAILanguageModelResponsesOptions', () => {
      expectTypeOf<AzureOpenAIResponsesProviderOptions>().toEqualTypeOf<AzureOpenAILanguageModelResponsesOptions>();
    });
    it('OpenAIChatLanguageModelOptions equals OpenAILanguageModelChatOptions', () => {
      expectTypeOf<AzureOpenAIChatLanguageModelOptions>().toEqualTypeOf<AzureOpenAILanguageModelChatOptions>();
    });
  });

  describe('@ai-sdk/black-forest-labs', () => {
    it('BlackForestLabsImageProviderOptions equals BlackForestLabsImageModelOptions', () => {
      expectTypeOf<BlackForestLabsImageProviderOptions>().toEqualTypeOf<BlackForestLabsImageModelOptions>();
    });
  });

  describe('@ai-sdk/cohere', () => {
    it('CohereChatModelOptions equals CohereLanguageModelOptions', () => {
      expectTypeOf<CohereChatModelOptions>().toEqualTypeOf<CohereLanguageModelOptions>();
    });
    it('CohereRerankingOptions equals CohereRerankingModelOptions', () => {
      expectTypeOf<CohereRerankingOptions>().toEqualTypeOf<CohereRerankingModelOptions>();
    });
  });

  describe('@ai-sdk/deepgram', () => {
    it('DeepgramSpeechCallOptions equals DeepgramSpeechModelOptions', () => {
      expectTypeOf<DeepgramSpeechCallOptions>().toEqualTypeOf<DeepgramSpeechModelOptions>();
    });
  });

  describe('@ai-sdk/deepseek', () => {
    it('DeepSeekChatOptions equals DeepSeekLanguageModelOptions', () => {
      expectTypeOf<DeepSeekChatOptions>().toEqualTypeOf<DeepSeekLanguageModelOptions>();
    });
  });

  describe('@ai-sdk/fal', () => {
    it('FalImageProviderOptions equals FalImageModelOptions', () => {
      expectTypeOf<FalImageProviderOptions>().toEqualTypeOf<FalImageModelOptions>();
    });
    it('FalVideoProviderOptions equals FalVideoModelOptions', () => {
      expectTypeOf<FalVideoProviderOptions>().toEqualTypeOf<FalVideoModelOptions>();
    });
  });

  describe('@ai-sdk/fireworks', () => {
    it('FireworksProviderOptions equals FireworksLanguageModelOptions', () => {
      expectTypeOf<FireworksProviderOptions>().toEqualTypeOf<FireworksLanguageModelOptions>();
    });
    it('FireworksEmbeddingProviderOptions equals FireworksEmbeddingModelOptions', () => {
      expectTypeOf<FireworksEmbeddingProviderOptions>().toEqualTypeOf<FireworksEmbeddingModelOptions>();
    });
  });

  describe('@ai-sdk/gateway', () => {
    it('GatewayLanguageModelOptions equals GatewayProviderOptions', () => {
      expectTypeOf<GatewayLanguageModelOptions>().toEqualTypeOf<GatewayProviderOptions>();
    });
  });

  describe('@ai-sdk/google', () => {
    it('GoogleGenerativeAIProviderOptions equals GoogleLanguageModelOptions', () => {
      expectTypeOf<GoogleGenerativeAIProviderOptions>().toEqualTypeOf<GoogleLanguageModelOptions>();
    });
    it('GoogleGenerativeAIImageProviderOptions equals GoogleImageModelOptions', () => {
      expectTypeOf<GoogleGenerativeAIImageProviderOptions>().toEqualTypeOf<GoogleImageModelOptions>();
    });
    it('GoogleGenerativeAIEmbeddingProviderOptions equals GoogleEmbeddingModelOptions', () => {
      expectTypeOf<GoogleGenerativeAIEmbeddingProviderOptions>().toEqualTypeOf<GoogleEmbeddingModelOptions>();
    });
    it('GoogleGenerativeAIVideoProviderOptions equals GoogleVideoModelOptions', () => {
      expectTypeOf<GoogleGenerativeAIVideoProviderOptions>().toEqualTypeOf<GoogleVideoModelOptions>();
    });
    it('GoogleGenerativeAIProvider equals GoogleProvider', () => {
      expectTypeOf<GoogleGenerativeAIProvider>().toEqualTypeOf<GoogleProvider>();
    });
    it('GoogleGenerativeAIProviderSettings equals GoogleProviderSettings', () => {
      expectTypeOf<GoogleGenerativeAIProviderSettings>().toEqualTypeOf<GoogleProviderSettings>();
    });
    it('GoogleGenerativeAIProviderMetadata equals GoogleProviderMetadata', () => {
      expectTypeOf<GoogleGenerativeAIProviderMetadata>().toEqualTypeOf<GoogleProviderMetadata>();
    });
    it('GoogleGenerativeAIVideoModelId equals GoogleVideoModelId', () => {
      expectTypeOf<GoogleGenerativeAIVideoModelId>().toEqualTypeOf<GoogleVideoModelId>();
    });
  });

  describe('@ai-sdk/google-vertex', () => {
    it('GoogleVertexImageProviderOptions equals GoogleVertexImageModelOptions', () => {
      expectTypeOf<GoogleVertexImageProviderOptions>().toEqualTypeOf<GoogleVertexImageModelOptions>();
    });
    it('GoogleVertexVideoProviderOptions equals GoogleVertexVideoModelOptions', () => {
      expectTypeOf<GoogleVertexVideoProviderOptions>().toEqualTypeOf<GoogleVertexVideoModelOptions>();
    });
  });

  describe('@ai-sdk/groq', () => {
    it('GroqProviderOptions equals GroqLanguageModelOptions', () => {
      expectTypeOf<GroqProviderOptions>().toEqualTypeOf<GroqLanguageModelOptions>();
    });
  });

  describe('@ai-sdk/klingai', () => {
    it('KlingAIVideoProviderOptions equals KlingAIVideoModelOptions', () => {
      expectTypeOf<KlingAIVideoProviderOptions>().toEqualTypeOf<KlingAIVideoModelOptions>();
    });
  });

  describe('@ai-sdk/luma', () => {
    it('LumaImageProviderOptions equals LumaImageModelOptions', () => {
      expectTypeOf<LumaImageProviderOptions>().toEqualTypeOf<LumaImageModelOptions>();
    });
  });

  describe('@ai-sdk/moonshotai', () => {
    it('MoonshotAIProviderOptions equals MoonshotAILanguageModelOptions', () => {
      expectTypeOf<MoonshotAIProviderOptions>().toEqualTypeOf<MoonshotAILanguageModelOptions>();
    });
  });

  describe('@ai-sdk/openai', () => {
    it('OpenAIResponsesProviderOptions equals OpenAILanguageModelResponsesOptions', () => {
      expectTypeOf<OpenAIResponsesProviderOptions>().toEqualTypeOf<OpenAILanguageModelResponsesOptions>();
    });
    it('OpenAIChatLanguageModelOptions equals OpenAILanguageModelChatOptions', () => {
      expectTypeOf<OpenAIChatLanguageModelOptions>().toEqualTypeOf<OpenAILanguageModelChatOptions>();
    });
  });

  describe('@ai-sdk/openai-compatible', () => {
    it('OpenAICompatibleProviderOptions equals OpenAICompatibleLanguageModelChatOptions', () => {
      expectTypeOf<OpenAICompatibleProviderOptions>().toEqualTypeOf<OpenAICompatibleLanguageModelChatOptions>();
    });
    it('OpenAICompatibleCompletionProviderOptions equals OpenAICompatibleLanguageModelCompletionOptions', () => {
      expectTypeOf<OpenAICompatibleCompletionProviderOptions>().toEqualTypeOf<OpenAICompatibleLanguageModelCompletionOptions>();
    });
    it('OpenAICompatibleEmbeddingProviderOptions equals OpenAICompatibleEmbeddingModelOptions', () => {
      expectTypeOf<OpenAICompatibleEmbeddingProviderOptions>().toEqualTypeOf<OpenAICompatibleEmbeddingModelOptions>();
    });
  });

  describe('@ai-sdk/prodia', () => {
    it('ProdiaImageProviderOptions equals ProdiaImageModelOptions', () => {
      expectTypeOf<ProdiaImageProviderOptions>().toEqualTypeOf<ProdiaImageModelOptions>();
    });
  });

  describe('@ai-sdk/replicate', () => {
    it('ReplicateImageProviderOptions equals ReplicateImageModelOptions', () => {
      expectTypeOf<ReplicateImageProviderOptions>().toEqualTypeOf<ReplicateImageModelOptions>();
    });
    it('ReplicateVideoProviderOptions equals ReplicateVideoModelOptions', () => {
      expectTypeOf<ReplicateVideoProviderOptions>().toEqualTypeOf<ReplicateVideoModelOptions>();
    });
  });

  describe('@ai-sdk/togetherai', () => {
    it('TogetherAIRerankingOptions equals TogetherAIRerankingModelOptions', () => {
      expectTypeOf<TogetherAIRerankingOptions>().toEqualTypeOf<TogetherAIRerankingModelOptions>();
    });
    it('TogetherAIImageProviderOptions equals TogetherAIImageModelOptions', () => {
      expectTypeOf<TogetherAIImageProviderOptions>().toEqualTypeOf<TogetherAIImageModelOptions>();
    });
  });

  describe('@ai-sdk/xai', () => {
    it('XaiProviderOptions equals XaiLanguageModelChatOptions', () => {
      expectTypeOf<XaiProviderOptions>().toEqualTypeOf<XaiLanguageModelChatOptions>();
    });
    it('XaiResponsesProviderOptions equals XaiLanguageModelResponsesOptions', () => {
      expectTypeOf<XaiResponsesProviderOptions>().toEqualTypeOf<XaiLanguageModelResponsesOptions>();
    });
    it('XaiImageProviderOptions equals XaiImageModelOptions', () => {
      expectTypeOf<XaiImageProviderOptions>().toEqualTypeOf<XaiImageModelOptions>();
    });
  });
});
