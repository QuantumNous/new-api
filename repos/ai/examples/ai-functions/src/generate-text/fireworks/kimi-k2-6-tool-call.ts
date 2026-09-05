import {
  fireworks,
  type FireworksLanguageModelOptions,
} from '@ai-sdk/fireworks';
import { generateText, isStepCount } from 'ai';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const sessionId = 'weather-conversation-123';

  const result = await generateText({
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

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log(
    'Cached input tokens:',
    result.usage.inputTokenDetails.cacheReadTokens,
  );
  console.log('Finish reason:', result.finishReason);
});
