import type { FireworksLanguageModelOptions } from '@ai-sdk/fireworks';
import { gateway } from '@ai-sdk/gateway';
import { isStepCount, streamText } from 'ai';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const result = streamText({
    model: gateway('moonshotai/kimi-k2.5'),
    providerOptions: {
      fireworks: {
        thinking: { type: 'enabled', budgetTokens: 4096 },
        reasoningHistory: 'interleaved',
      } satisfies FireworksLanguageModelOptions,
    },
    tools: { weather: weatherTool },
    stopWhen: isStepCount(2),
    prompt: 'What is the weather in San Francisco?',
  });

  printFullStream({ result });
});
