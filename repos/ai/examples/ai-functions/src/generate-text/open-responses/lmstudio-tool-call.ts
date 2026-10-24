import { createOpenResponses } from '@ai-sdk/open-responses';
import { generateText } from 'ai';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

const lmstudio = createOpenResponses({
  name: 'lmstudio',
  url: 'http://localhost:1234/v1/responses',
});

run(async () => {
  const result = await generateText({
    model: lmstudio('zai-org/glm-4.7-flash'),
    tools: {
      weather: weatherTool,
    },
    toolChoice: 'required',
    prompt: 'What is the weather in San Francisco?',
    maxRetries: 0,
  });

  console.log('Content:', JSON.stringify(result.content, null, 2));
  console.log('Finish reason:', result.finishReason);
});
