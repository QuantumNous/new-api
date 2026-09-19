import { openai } from '@ai-sdk/openai';
import { generateText, jsonSchema, tool } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-3.5-turbo'),
    maxOutputTokens: 512,
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: jsonSchema<{ location: string }>({
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
          required: ['location'],
        }),
        // location below is inferred to be a string:
        execute: async ({ location }) => ({
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
        }),
      }),
      cityAttractions: tool({
        inputSchema: jsonSchema<{ city: string }>({
          type: 'object',
          properties: {
            city: { type: 'string' },
          },
          required: ['city'],
        }),
      }),
    },
    prompt:
      'What is the weather in San Francisco and what attractions should I visit?',
  });

  // typed tool calls:
  for (const toolCall of result.toolCalls) {
    if (toolCall.dynamic) {
      continue;
    }

    switch (toolCall.toolName) {
      case 'cityAttractions': {
        toolCall.input.city; // string
        break;
      }

      case 'weather': {
        toolCall.input.location; // string
        break;
      }
    }
  }

  // typed tool results for tools with execute method:
  for (const toolResult of result.toolResults) {
    if (toolResult.dynamic) {
      continue;
    }

    switch (toolResult.toolName) {
      // NOT AVAILABLE (NO EXECUTE METHOD)
      // case 'cityAttractions': {
      //   toolResult.input.city; // string
      //   toolResult.result;
      //   break;
      // }

      case 'weather': {
        toolResult.input.location; // string
        toolResult.output.location; // string
        toolResult.output.temperature; // number
        break;
      }
    }
  }

  console.log(JSON.stringify(result, null, 2));
});
