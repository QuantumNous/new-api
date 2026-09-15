import { anthropic } from '@ai-sdk/anthropic';
import { isStepCount, streamText } from 'ai';
import { weatherTool } from '../../tools/weather-tool';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: anthropic('claude-fable-5'),
    stopWhen: isStepCount(5),
    tools: {
      weather: weatherTool,
    },
    prompt:
      'What is the weather in San Francisco, New York, and London? ' +
      'Compare them and tell me which is warmest.',
  });

  await printFullStream({ result });
});
