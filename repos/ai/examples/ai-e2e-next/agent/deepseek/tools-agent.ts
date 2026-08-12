import { weatherTool } from '@/tool/weather-tool';
import { deepSeek } from '@ai-sdk/deepseek';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
export const deepseekToolsAgent = new ToolLoopAgent({
  model: deepSeek('deepseek-reasoner'),
  tools: { weather: weatherTool },
});

export type DeepSeekToolsAgentMessage = InferAgentUIMessage<
  typeof deepseekToolsAgent
>;
