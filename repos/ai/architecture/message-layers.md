Four level message architecture summary

- UI messages: Contain data parts, shaped for UI rendering ([packages/ai/src/ui/ui-messages.ts](https://github.com/vercel/ai/blob/main/packages/ai/src/ui/ui-messages.ts))
- Model messages: Abstracted, user-friendly version for good DX, used in generate/stream calls ([packages/provider-utils/src/types/model-message.ts](https://github.com/vercel/ai/blob/main/packages/provider-utils/src/types/model-message.ts))
- Language model messages: Standardized spec, intended to be stable ([packages/provider/src/language-model/v4/language-model-v4-prompt.ts](https://github.com/vercel/ai/blob/main/packages/provider/src/language-model/v4/language-model-v4-prompt.ts))
- Provider-specific messages: Final conversion for specific API requirements (see e.g. [`getArgs()` and `doGenerate()` method of `OpenAIResponsesLanguageModel`](https://github.com/vercel/ai/blob/156cdf0600eabb7a5e39a13db229b67787124a23/packages/openai/src/responses/openai-responses-language-model.ts)
