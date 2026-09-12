import { tool, type UIToolInvocation } from 'ai';
import { z } from 'zod';

export const weatherTool = tool({
  description: 'Get the weather in a location',
  inputSchema: z.object({ city: z.string() }),
  async *execute({ city }: { city: string }) {
    yield { state: 'loading' as const };

    // Add artificial delay of 5 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    const weatherOptions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
    const weather =
      weatherOptions[Math.floor(Math.random() * weatherOptions.length)];

    yield {
      state: 'ready' as const,
      temperature: 72,
      weather,
    };
  },
});

export type WeatherUIToolInvocation = UIToolInvocation<typeof weatherTool>;
