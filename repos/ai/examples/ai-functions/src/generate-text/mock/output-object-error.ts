import { generateText, NoObjectGeneratedError, Output } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  try {
    await generateText({
      model: new MockLanguageModelV3({
        doGenerate: async () => ({
          warnings: [],
          content: [{ type: 'text', text: `{"content":"Hello broken json` }],
          response: {
            id: 'id-1',
            timestamp: new Date(123),
            modelId: 'model-1',
          },
          finishReason: { raw: undefined, unified: 'stop' },
          usage: {
            inputTokens: {
              total: 10,
              noCache: 10,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: 20,
              text: 20,
              reasoning: undefined,
            },
          },
        }),
      }),
      output: Output.object({
        schema: z.object({ content: z.string() }),
      }),
      prompt: 'Hello, test!',
    });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      console.log('NoObjectGeneratedError');
      console.log('Cause:', error.cause);
      console.log('Text:', error.text);
      console.log('Response:', error.response);
      console.log('Usage:', error.usage);
    }
  }
});
