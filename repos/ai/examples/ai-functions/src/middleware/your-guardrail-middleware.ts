import type {
  LanguageModelV3Content,
  LanguageModelV3Middleware,
} from '@ai-sdk/provider';

export const yourGuardrailMiddleware: LanguageModelV3Middleware = {
  specificationVersion: 'v3',
  wrapGenerate: async ({ doGenerate }) => {
    const { content, ...rest } = await doGenerate();

    // filtering approach, e.g. for PII or other sensitive information:
    const cleanedContent: Array<LanguageModelV3Content> = content.map(part => {
      return part.type === 'text'
        ? {
            type: 'text',
            text: part.text.replace(/badword/g, '<REDACTED>'),
          }
        : part;
    });

    return {
      content: cleanedContent,
      ...rest,
    };
  },

  // here you would implement the guardrail logic for streaming
  // Note: streaming guardrails are difficult to implement, because
  // you do not know the full content of the stream until it's finished.
};
