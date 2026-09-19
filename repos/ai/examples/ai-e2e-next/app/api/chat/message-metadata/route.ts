import { createAgentUIStreamResponse, type UIMessage } from 'ai';
import {
  openaiMetadataAgent,
  type ExampleMetadata,
} from '@/agent/openai/metadata-agent';
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  return createAgentUIStreamResponse({
    agent: openaiMetadataAgent,
    uiMessages: messages,
    messageMetadata: ({ part }): ExampleMetadata | undefined => {
      // send custom information to the client on start:
      if (part.type === 'start') {
        return {
          createdAt: Date.now(),
          model: 'gpt-4o', // initial model id
        };
      }

      // send additional model information on finish-step:
      if (part.type === 'finish-step') {
        return {
          model: part.response.modelId, // update with the actual model id
        };
      }

      // when the message is finished, send additional information:
      if (part.type === 'finish') {
        return {
          totalTokens: part.totalUsage.totalTokens,
          finishReason: part.finishReason,
        };
      }
    },
  });
}
