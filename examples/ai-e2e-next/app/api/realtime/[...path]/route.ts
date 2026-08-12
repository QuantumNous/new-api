import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import {
  experimental_getRealtimeToolDefinitions as getRealtimeToolDefinitions,
  gateway,
  type Experimental_RealtimeFactory as RealtimeFactory,
  type Experimental_RealtimeSessionConfig as RealtimeSessionConfig,
  tool,
} from 'ai';
import { z } from 'zod';

const getWeatherInputSchema = z.object({
  city: z.string().describe('The city to get weather for'),
});

const getWeather = ({ city }: z.infer<typeof getWeatherInputSchema>) => {
  const conditions = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
  return {
    city,
    temperature: Math.floor(Math.random() * 35) + 5,
    condition: conditions[Math.floor(Math.random() * conditions.length)],
  };
};

const rollDice = () => ({
  result: Math.floor(Math.random() * 6) + 1,
});

const tools = {
  getWeather: tool({
    description: 'Get the current weather for a city',
    inputSchema: getWeatherInputSchema,
  }),
  rollDice: tool({
    description: 'Roll a six-sided die and return the result',
    inputSchema: z.object({}),
  }),
};

const providers: Record<
  string,
  { factory: RealtimeFactory; model: string; includeTools?: boolean }
> = {
  openai: {
    factory: openai.experimental_realtime,
    model: 'gpt-realtime',
  },
  google: {
    factory: google.experimental_realtime,
    model: 'gemini-3.1-flash-live-preview',
  },
  'google-live-translate': {
    factory: google.experimental_realtime,
    model: 'gemini-3.5-live-translate-preview',
    includeTools: false,
  },
  xai: {
    factory: xai.experimental_realtime,
    model: 'grok-voice-latest',
  },
  gateway: {
    factory: gateway.experimental_realtime,
    model: 'openai/gpt-realtime-2',
  },
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await params;
  const route = path.join('/');

  if (route === 'setup') {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') ?? 'openai';

    const body = await request.json().catch(() => ({}));
    const sessionConfig: RealtimeSessionConfig | undefined =
      body.sessionConfig ?? undefined;

    const providerConfig = providers[provider] ?? providers.openai;
    const toolDefs =
      providerConfig.includeTools === false
        ? undefined
        : await getRealtimeToolDefinitions({ tools });

    const { factory, model } = providerConfig;
    const tokenResult = await factory.getToken({
      model,
      sessionConfig:
        toolDefs == null
          ? sessionConfig
          : { ...sessionConfig, tools: toolDefs },
    });

    return Response.json({
      ...tokenResult,
      ...(toolDefs == null ? {} : { tools: toolDefs }),
    });
  }

  if (route === 'weather') {
    const input = getWeatherInputSchema.safeParse(await request.json());
    if (!input.success) {
      return Response.json({ error: 'Invalid weather input' }, { status: 400 });
    }

    return Response.json(getWeather(input.data));
  }

  if (route === 'roll-dice') {
    return Response.json(rollDice());
  }

  return new Response('Not found', { status: 404 });
}
