import { deepSeek } from '@ai-sdk/deepseek';
import { generateText, Output, isStepCount } from 'ai';
import { print } from '../../lib/print';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

run(async () => {
  const result = await generateText({
    model: deepSeek('deepseek-reasoner'),
    tools: { weather: weatherTool },
    stopWhen: isStepCount(5),
    output: Output.json(),
    prompt: 'What is the weather in San Francisco, London, Paris, and Berlin?',
  });

  print('Output:', result.output);
  print('Request:', result.request.body);
});
