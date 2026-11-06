import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  wrapLanguageModel,
  type InferUITools,
  type LanguageModelMiddleware,
  type UIDataTypes,
  type UIMessage,
} from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

// Simulate a model emitting malformed JSON (trailing comma) as its tool input.
const corruptToolCallInput: LanguageModelMiddleware = {
  wrapStream: async ({ doStream }) => {
    const { stream, ...rest } = await doStream();
    return {
      ...rest,
      stream: stream.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            controller.enqueue(
              chunk.type === 'tool-call'
                ? { ...chunk, input: '{ "city": "San Francisco", }' }
                : chunk,
            );
          },
        }),
      ),
    };
  },
};

const tools = {
  cityAttractions: tool({
    description: 'Get tourist attractions for a city',
    inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }) => ({
      city,
      attractions: ['Golden Gate Bridge', 'Exploratorium'],
    }),
  }),
} as const;

export type BedrockInvalidToolCallMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<typeof tools>
>;

export async function POST(req: Request) {
  const { messages }: { messages: BedrockInvalidToolCallMessage[] } =
    await req.json();

  const model = amazonBedrock('us.anthropic.claude-sonnet-4-5-20250929-v1:0');

  // First turn (no assistant message yet): make the model emit a malformed
  // tool call. It is persisted into the chat history with a raw-string input.
  //
  // Later turns: replay that history back to Bedrock. Bedrock rejects a string
  // `toolUse.input` ("Provide a json object...") unless the parse-tool-call fix
  // wraps the invalid input in an object.
  const isReplay = messages.some(message => message.role === 'assistant');

  const result = streamText({
    model: isReplay
      ? model
      : wrapLanguageModel({ model, middleware: corruptToolCallInput }),
    tools,
    messages: await convertToModelMessages(messages),
    toolChoice: isReplay
      ? undefined
      : { type: 'tool', toolName: 'cityAttractions' },
    stopWhen: isStepCount(isReplay ? 5 : 1),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      // surface the real Bedrock error on the client instead of a generic message
      onError: error =>
        error instanceof Error ? error.message : String(error),
    }),
  });
}
