import { google } from '@ai-sdk/google';
import { streamText, isStepCount } from 'ai';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: google.interactions('gemini-2.5-flash'),
    tools: { getWeather: weatherTool },
    stopWhen: isStepCount(5),
    prompt: 'What is the weather in San Francisco right now?',
  });

  for await (const part of result.stream) {
    if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    } else if (part.type === 'tool-call') {
      console.log();
      console.log(
        `[tool-call] ${part.toolName}(${JSON.stringify(part.input)})`,
      );
    } else if (part.type === 'tool-result') {
      console.log(
        `[tool-result] ${part.toolName} =>`,
        JSON.stringify(part.output),
      );
    }
  }

  const googleMetadata = (await result.finalStep).providerMetadata?.google;

  console.log();
  console.log('Final text:', await result.text);
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
  console.log('Interaction id:', googleMetadata?.interactionId);
});
