import { anthropicAws } from '@ai-sdk/anthropic-aws';
import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropicAws('claude-sonnet-4-6'),
    maxOutputTokens: 512,
    tools: {
      weather: weatherTool,
      cityAttractions: tool({
        inputSchema: z.object({ city: z.string() }),
      }),
    },
    stopWhen: stepCountIs(5),
    prompt:
      'What is the weather in San Francisco and what attractions should I visit?',
  });

  console.log('Text:', result.text);
  console.log('Tool Calls:', JSON.stringify(result.toolCalls, null, 2));
  console.log('Tool Results:', JSON.stringify(result.toolResults, null, 2));
  console.log('Steps:', result.steps.length);
});
