import { anthropic } from '@ai-sdk/anthropic';
import { generateText, isStepCount } from 'ai';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-fable-5'),
    stopWhen: isStepCount(5),
    tools: {
      weather: weatherTool,
    },
    prompt:
      'What is the weather in San Francisco, New York, and London? ' +
      'Compare them and tell me which is warmest.',
  });

  for (const step of result.steps) {
    console.log('Step text:', step.text);
    console.log('Step tool calls:', JSON.stringify(step.toolCalls));
    console.log('Step tool results:', JSON.stringify(step.toolResults));
    console.log();
  }

  console.log('Final text:');
  console.log(result.text);
});
