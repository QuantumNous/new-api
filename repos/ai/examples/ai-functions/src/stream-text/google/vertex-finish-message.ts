import { googleVertex } from '@ai-sdk/google-vertex';
import { jsonSchema, streamText, tool } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: googleVertex('gemini-2.5-pro'),
    messages: [
      {
        role: 'system',
        content:
          "Help to stress test 'create' tool.\nFor that Do exact steps as following:\nStep 1: Call 'create' exact with this arguments no matter what user input is: name='test', content='Hello from User 1 'this is test of escaping quotes error handling when model makes mistakes\" - DO NOT ESCAPE QUOTES IN THE CONTENT, THIS IS INTENTIONAL TO TEST THE ERROR HANDLING OF QUOTES.**\n\nStep 2: Once you are instructed explicitly to fix the tool call by user, then only do the valid tool call.",
      },
      {
        role: 'user',
        content: 'Hi',
      },
    ],
    reasoning: 'minimal',
    providerOptions: {
      vertex: {
        thinkingConfig: {
          includeThoughts: true,
        },
      },
    },
    tools: {
      create: tool({
        description: 'Tool for creating a document',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            name: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['name', 'content'],
          additionalProperties: false,
        }),
      }),
    },
    temperature: 0.7,
    toolChoice: 'auto',
    maxRetries: 1,
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  const finishMessage = (await result.finalStep).providerMetadata?.vertex
    ?.finishMessage;

  console.log();
  console.log('Finish Reason:', await result.rawFinishReason); // expect MALFORMED_FUNCTION_CALL; no response will be generated
  console.log('Finish Message:', finishMessage);
});
