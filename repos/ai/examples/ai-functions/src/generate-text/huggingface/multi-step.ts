import { huggingFace } from '@ai-sdk/huggingface';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod/v4';
import { run } from '../../lib/run';

run(async () => {
  const { text, usage } = await generateText({
    model: huggingFace.responses('deepseek-ai/DeepSeek-V3-0324'),
    tools: {
      currentLocation: tool({
        description: 'Get the current location.',
        inputSchema: z.object({}),
        execute: async () => {
          const locations = ['New York', 'London', 'Paris', 'Tokyo', 'Sydney'];
          return {
            location: locations[Math.floor(Math.random() * locations.length)],
          };
        },
      }),
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        execute: async ({ location }) => ({
          location,
          temperature: 72 + Math.floor(Math.random() * 21) - 10,
          condition: ['sunny', 'cloudy', 'rainy', 'snowy'][
            Math.floor(Math.random() * 4)
          ],
        }),
      }),
      recommendations: tool({
        description: 'Get activity recommendations based on weather',
        inputSchema: z.object({
          location: z.string(),
          weather: z.string(),
          temperature: z.number(),
        }),
        execute: async ({ location, weather, temperature }) => {
          const activities = {
            sunny: ['visit a park', 'go for a walk', 'outdoor dining'],
            cloudy: ['visit a museum', 'go shopping', 'indoor activities'],
            rainy: ['visit a library', 'go to a cafe', 'indoor entertainment'],
            snowy: ['build a snowman', 'go skiing', 'stay warm indoors'],
          };
          return {
            location,
            activities: activities[weather as keyof typeof activities] || [
              'explore the city',
            ],
          };
        },
      }),
    },
    stopWhen: isStepCount(5),
    prompt:
      'What activities would you recommend for today based on my current location and weather?',

    onStepFinish: step => {
      console.log('Step completed:');
      console.log('Text:', step.text);
      console.log('Tool calls:', step.toolCalls.length);
      console.log('Tool results:', step.toolResults.length);
      console.log('---');
    },
  });

  console.log('Final response:', text);
  console.log();
  console.log('Total usage:', usage);
});
