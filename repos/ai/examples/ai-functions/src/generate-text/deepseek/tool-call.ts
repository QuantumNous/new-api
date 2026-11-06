import { deepSeek } from '@ai-sdk/deepseek';
import { generateText, isStepCount } from 'ai';
import { print } from '../../lib/print';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const result = await generateText({
    model: deepSeek('deepseek-reasoner'),
    tools: { weather: weatherTool },
    stopWhen: isStepCount(2),
    prompt: 'What is the weather in San Francisco?',
  });

  print('Content:', result.content);
});
