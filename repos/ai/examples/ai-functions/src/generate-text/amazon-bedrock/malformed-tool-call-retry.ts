import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import {
  convertToModelMessages,
  generateText,
  isStepCount,
  readUIMessageStream,
  streamText,
  toUIMessageStream,
  tool,
  wrapLanguageModel,
  type LanguageModelMiddleware,
  type UIMessage,
} from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

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

run(async () => {
  const model = amazonBedrock('us.anthropic.claude-sonnet-4-5-20250929-v1:0');

  const tools = {
    cityAttractions: tool({
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ city, attractions: ['Golden Gate'] }),
    }),
  };

  const prompt = 'What are the tourist attractions in San Francisco?';

  // Turn 1: stream the malformed tool call into a persisted UI message,
  // like a `useChat` server -> client flow.
  const stream = streamText({
    model: wrapLanguageModel({ model, middleware: corruptToolCallInput }),
    tools,
    toolChoice: { type: 'tool', toolName: 'cityAttractions' },
    prompt,
  });

  let assistantMessage: UIMessage | undefined;
  for await (const uiMessage of readUIMessageStream({
    stream: toUIMessageStream({ stream: stream.stream }),
  })) {
    assistantMessage = uiMessage;
  }

  // Turn 2: replay the persisted conversation. `convertToModelMessages` is the
  // unguarded path that passes the raw-string tool input straight to Bedrock,
  // which rejects it unless it is a JSON object.
  const messages = await convertToModelMessages([
    { id: '1', role: 'user', parts: [{ type: 'text', text: prompt }] },
    assistantMessage!,
  ]);

  console.log('Replayed tool-call input:', messages[1].content);

  const result = await generateText({
    model,
    tools,
    messages,
    stopWhen: isStepCount(5),
  });

  console.log('Recovered:', result.text);
});
