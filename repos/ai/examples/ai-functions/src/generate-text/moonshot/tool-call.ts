import { moonshotai } from '@ai-sdk/moonshotai';
import { generateText, isStepCount } from 'ai';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const result = await generateText({
    model: moonshotai('kimi-k2.5'),
    tools: { weather: weatherTool },
    stopWhen: isStepCount(2),
    prompt: 'What is the weather in San Francisco?',
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
