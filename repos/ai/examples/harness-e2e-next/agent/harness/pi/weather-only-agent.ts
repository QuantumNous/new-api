import { weatherTool } from '@/lib/tools/weather-tool';
import {
  WEATHER_CODES_REFERENCE,
  weatherCodesSkill,
  weatherForecastSkill,
  weatherInstructions,
} from '@/lib/weather-utils';
import {
  HarnessAgent,
  createFileReporter,
  createTraceTreeReporter,
} from '@ai-sdk/harness/agent';
import { pi } from '@ai-sdk/harness-pi';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import type { InferUITools, UIMessage } from 'ai';

export const weatherPiHarnessAgent = new HarnessAgent({
  harness: pi,
  instructions: weatherInstructions,
  skills: [weatherForecastSkill, weatherCodesSkill],
  tools: { get_weather: weatherTool },
  activeTools: ['get_weather'],
  sandbox: createVercelSandbox({
    runtime: 'node24',
  }),
  sandboxConfig: {
    onSession: async ({ session, sessionWorkDir, abortSignal }) => {
      await session.writeTextFile({
        path: `${sessionWorkDir}/weather-codes.md`,
        content: WEATHER_CODES_REFERENCE,
        abortSignal,
      });
    },
  },
  debug: { enabled: true },
  telemetry: {
    integrations: [
      createTraceTreeReporter(),
      createFileReporter({ dir: '.harness-observability/pi/weather' }),
    ],
  },
});

/*
 * See `basic-agent.ts` for the rationale behind deriving the UIMessage type
 * from `agent.tools` instead of `InferAgentUIMessage<typeof agent>`.
 */
export type WeatherPiHarnessAgentMessage = UIMessage<
  unknown,
  never,
  InferUITools<typeof weatherPiHarnessAgent.tools>
>;
