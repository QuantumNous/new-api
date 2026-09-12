import { generateText } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { run } from '../../lib/run';

run(async () => {
  const { text, usage } = await generateText({
    model: new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [{ type: 'text', text: `Hello, world!` }],
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
    prompt: 'Hello, test!',
  });

  console.log(text);
  console.log();
  console.log('Usage:', usage);
});
