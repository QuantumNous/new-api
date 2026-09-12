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
import { claudeCode } from '@ai-sdk/harness-claude-code';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import type { InferUITools, UIMessage } from 'ai';

export const weatherClaudeCodeHarnessAgent = new HarnessAgent({
  harness: claudeCode,
  instructions: weatherInstructions,
  skills: [weatherForecastSkill, weatherCodesSkill],
  tools: { get_weather: weatherTool },
  activeTools: ['get_weather'],
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
      createFileReporter({ dir: '.harness-observability/claude-code/weather' }),
    ],
  },
});

/*
 * See `basic-agent.ts` for the rationale behind deriving the UIMessage type
 * from `agent.tools` instead of `InferAgentUIMessage<typeof agent>`.
 */
export type WeatherClaudeCodeHarnessAgentMessage = UIMessage<
  unknown,
  never,
  InferUITools<typeof weatherClaudeCodeHarnessAgent.tools>
>;
