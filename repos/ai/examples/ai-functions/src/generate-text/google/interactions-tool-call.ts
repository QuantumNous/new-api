import { google } from '@ai-sdk/google';
import { generateText, isStepCount } from 'ai';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google.interactions('gemini-2.5-flash'),
    tools: { getWeather: weatherTool },
    stopWhen: isStepCount(5),
    prompt: 'What is the weather in San Francisco right now?',
  });

  const googleMetadata = result.finalStep.providerMetadata?.google;

  console.log('Final text:');
  console.log(result.text);
  console.log();
  console.log('Tool calls:', JSON.stringify(result.toolCalls, null, 2));
  console.log('Tool results:', JSON.stringify(result.toolResults, null, 2));
  console.log('Steps:', result.steps.length);
  console.log('Finish reason:', result.finishReason);
  console.log('Token usage:', result.usage);
  console.log('Interaction id:', googleMetadata?.interactionId);
});
