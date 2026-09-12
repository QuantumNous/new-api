import {
  fireworks,
  type FireworksLanguageModelOptions,
} from '@ai-sdk/fireworks';
import { isStepCount, streamText } from 'ai';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const sessionId = 'weather-conversation-123';

  const result = streamText({
    model: fireworks('accounts/fireworks/models/kimi-k2p6'),
    providerOptions: {
      fireworks: {
        promptCacheKey: sessionId,
        thinking: { type: 'enabled', budgetTokens: 4096 },
        reasoningHistory: 'interleaved',
      } satisfies FireworksLanguageModelOptions,
    },
    tools: { weather: weatherTool },
    stopWhen: isStepCount(2),
    prompt: 'What is the weather in San Francisco?',
  });

  await printFullStream({ result });
  console.log('Token usage:', await result.usage);
});
