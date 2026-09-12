import { tool, type UIToolInvocation } from 'ai';
import * as v from 'valibot';
import { valibotSchema } from '@ai-sdk/valibot';

function randomWeather() {
  const weatherOptions = ['sunny', 'cloudy', 'rainy', 'windy'];
  return weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
}

export const weatherToolValibot = tool({
  description: 'Get the weather in a location',
  inputSchema: valibotSchema(v.object({ city: v.string() })),
  async *execute() {
    yield { state: 'loading' as const };

    // Add randomized delay of 1 and 5 seconds (to mix up tool result ordering)
    await new Promise(resolve =>
      setTimeout(resolve, 1000 + Math.floor(Math.random() * 4000)),
    );

    yield {
      state: 'ready' as const,
      temperature: 72,
      weather: randomWeather(),
    };
  },
});

export type WeatherUIToolValibotInvocation = UIToolInvocation<
  typeof weatherToolValibot
>;
