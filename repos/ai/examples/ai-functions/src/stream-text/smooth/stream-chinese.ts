import { simulateReadableStream, smoothStream, streamText } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: new MockLanguageModelV3({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-start', id: '0' },
            {
              type: 'text-delta',
              id: '0',
              delta:
                '今天天气很好，我们一起去公园散步吧。春天的花朵非常美丽，阳光温暖而舒适。这是一个完美的周末。',
            },
            { type: 'text-end', id: '0' },
            {
              type: 'finish',
              finishReason: { raw: undefined, unified: 'stop' },
              logprobs: undefined,
              usage: {
                inputTokens: {
                  total: 3,
                  noCache: 3,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: 10,
                  text: 10,
                  reasoning: undefined,
                },
              },
            },
          ],
        }),
      }),
    }),
    prompt: 'Say hello in Chinese!',
    experimental_transform: smoothStream({
      chunking: new Intl.Segmenter('zh', { granularity: 'word' }),
      delayInMs: 100,
    }),
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
});
