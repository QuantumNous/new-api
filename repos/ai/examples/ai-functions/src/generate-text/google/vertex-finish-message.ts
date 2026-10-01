import { googleVertex } from '@ai-sdk/google-vertex';
import { generateText, jsonSchema, tool } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
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
        description: `Tool for creating a document`,
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

  const { rawFinishReason, response, text } = result;

  const finishMessage =
    result.finalStep.providerMetadata?.vertex?.finishMessage;

  console.log('Finish Reason:', rawFinishReason); // expect MALFORMED_FUNCTION_CALL
  console.log('Response:', JSON.stringify(response, null, 2)); // expect an error
  console.log('Finish Message:', finishMessage);
  console.log('Text:', text); // will be empty since the tool call is not executed
});
