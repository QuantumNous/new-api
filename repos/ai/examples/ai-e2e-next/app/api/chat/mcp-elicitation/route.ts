import { openai } from '@ai-sdk/openai';
import {
  createUIMessageStreamResponse,
  streamText,
  createUIMessageStream,
  convertToModelMessages,
  isStepCount,
  toUIMessageStream,
} from 'ai';
import { createMCPClient, ElicitationRequestSchema } from '@ai-sdk/mcp';
import type { MCPElicitationUIMessage } from './types';
import { createPendingElicitation } from './elicitation-store';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: MCPElicitationUIMessage[] } =
    await req.json();

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      return processMessages(messages, writer);
    },
  });

  return createUIMessageStreamResponse({ stream });
}

async function processMessages(
  messages: MCPElicitationUIMessage[],
  writer: any,
) {
  // Create MCP client with elicitation capabilities
  const mcpClient = await createMCPClient({
    transport: {
      type: 'sse',
      url: 'http://localhost:8085/sse',
    },
    capabilities: {
      elicitation: {},
    },
  });

  // Handle elicitation requests from the MCP server
  mcpClient.onElicitationRequest(ElicitationRequestSchema, async request => {
    const elicitationId = `elicit-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    try {
      // Send elicitation request to the frontend
      writer.write({
        type: 'data-elicitation-request',
        id: elicitationId,
        data: {
          elicitationId,
          message: request.params.message,
          requestedSchema: request.params.requestedSchema,
        },
      });

      // Wait for the user's response (will be resolved via the /respond endpoint)
      const userResponse = await createPendingElicitation(elicitationId);

      // Return the response in the format expected by the MCP server
      return {
        action: userResponse.action,
        content:
          userResponse.action === 'accept' ? userResponse.content : undefined,
      };
    } catch (error) {
      // Return a declined response on error
      return {
        action: 'decline' as const,
      };
    }
  });

  try {
    const tools = await mcpClient.tools();

    const result = streamText({
      model: openai('gpt-4o-mini'),
      tools,
      stopWhen: isStepCount(10),
      onStepFinish: async ({ toolResults }) => {
        if (toolResults.length > 0) {
          console.log('TOOL RESULTS:', JSON.stringify(toolResults, null, 2));
        }
      },
      instructions:
        'You are a helpful assistant. When asked to register a user, use the register_user tool.',
      messages: await convertToModelMessages(messages),
      onEnd: async () => {
        await mcpClient.close();
      },
    });

    writer.merge(
      toUIMessageStream({ stream: result.stream, originalMessages: messages }),
    );
  } catch (error) {
    console.error('Error processing messages:', error);
    await mcpClient.close();
    throw error;
  }
}
