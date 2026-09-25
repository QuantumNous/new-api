import { weatherTool } from '@/lib/tools/weather-tool';
import {
  WEATHER_CODES_REFERENCE,
  weatherCodesSkill,
  weatherForecastSkill,
  weatherInstructions,
} from '@/lib/weather-utils';
import {
  createFileReporter,
  createTraceTreeReporter,
  HarnessAgent,
} from '@ai-sdk/harness/agent';
import { deepAgents } from '@ai-sdk/harness-deepagents';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import type { InferUITools, UIMessage } from 'ai';

export const weatherDeepAgentsHarnessAgent = new HarnessAgent({
  harness: deepAgents,
  instructions: weatherInstructions,
  skills: [weatherForecastSkill, weatherCodesSkill],
  tools: { get_weather: weatherTool },
  sandbox: createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
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
      createFileReporter({ dir: '.harness-observability/deepagents/weather' }),
    ],
  },
});

// See basic-agent.ts for why the UIMessage type derives from agent.tools.
export type WeatherDeepAgentsHarnessAgentMessage = UIMessage<
  unknown,
  never,
  InferUITools<typeof weatherDeepAgentsHarnessAgent.tools>
>;
