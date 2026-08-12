import { weatherTool } from '@/tool/weather-tool';
import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
export const openaiWeatherToolApprovalAgent = new ToolLoopAgent({
  model: openai('gpt-5.4-mini'),
  // context engineering required to make sure the model does not retry
  // the tool execution if it is not approved for a particular tool call:
  instructions:
    'When a tool call was not approved by the user, ' +
    'do not retry the tool call with the same input.' +
    'Just say that the tool execution was not approved.' +
    'You can call a denied tool call with a different input.',
  tools: { weather: weatherTool },
  toolApproval: {
    weather: ({ city }) => {
      const cityLower = city.toLowerCase();
      if (cityLower.includes('san francisco') || cityLower === 'sf') {
        return 'approved';
      }

      if (cityLower.includes('new york') || cityLower === 'nyc') {
        return { type: 'denied', reason: 'blocked by policy' };
      }

      return 'user-approval';
    },
  },
});

export type OpenAIWeatherToolApprovalAgentUIMessage = InferAgentUIMessage<
  typeof openaiWeatherToolApprovalAgent
>;
