import { google } from '@ai-sdk/google';
import { generateText, isStepCount } from 'ai';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-3-flash-preview'),
    tools: {
      weather: weatherTool,
      google_search: google.tools.googleSearch({}),
    },
    prompt:
      'What is the weather in San Francisco and what are the latest news about the city?',
    stopWhen: isStepCount(5),
  });

  console.log('TEXT:', result.text);
  console.log('FINISH REASON:', result.finishReason);
  console.log('STEPS:', result.steps.length);
  for (const [i, step] of result.steps.entries()) {
    console.log(`\nSTEP ${i}:`);
    console.log('  finishReason:', step.finishReason);
    console.log('  text:', step.text.substring(0, 100));
    console.log(
      '  toolCalls:',
      step.toolCalls.map(
        tc => `${tc.toolName}(providerExecuted=${tc.providerExecuted})`,
      ),
    );
    console.log(
      '  toolResults:',
      step.toolResults.map(tr => tr.toolName),
    );
  }
});
