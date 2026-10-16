import { generateText, Output } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const { output, usage } = await generateText({
    model: new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [{ type: 'text', text: `{"content":"Hello, world!"}` }],
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
        warnings: [],
      }),
    }),
    output: Output.object({
      schema: z.object({ content: z.string() }),
    }),
    prompt: 'Hello, test!',
  });

  console.log(output);
  console.log();
  console.log('Usage:', usage);
});
