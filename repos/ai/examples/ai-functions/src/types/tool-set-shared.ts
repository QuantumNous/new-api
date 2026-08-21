import { tool, type InferUITools, type Tool, type UIMessage } from 'ai';
import { z } from 'zod';

type WeatherTool = Tool<
  {
    location: string;
  },
  {
    temperature: number;
    condition: string;
  }
>;

type MyToolSet = {
  weather: WeatherTool;
};

export type MyUITools = InferUITools<MyToolSet>;

export type MyUIMessage = UIMessage<never, never, MyUITools>;

const myUIMessage: MyUIMessage = undefined!;

myUIMessage.parts.forEach(part => {
  if (part.type === 'tool-weather') {
    if (part.state === 'input-available') {
      part.input.location;
    }
  }
});

export const serverWeatherTool = tool({
  description: 'Get the weather in a location',
  inputSchema: z.object({ location: z.string() }),
  execute({ location }: { location: string }) {
    return {
      condition: 'sunny',
      temperature: 72,
    };
  },
}) satisfies WeatherTool;
