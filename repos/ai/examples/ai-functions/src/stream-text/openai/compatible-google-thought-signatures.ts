import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, tool, type ModelMessage } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const googleOpenAI = createOpenAICompatible({
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    name: 'google',
    headers: {
      Authorization: `Bearer ${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
    },
  });

  const model = googleOpenAI.chatModel('gemini-3.1-pro-preview');

  const turn1 = streamText({
    model,
    tools: {
      check_flight: tool({
        description: 'Gets the current status of a flight',
        inputSchema: z.object({
          flight: z.string().describe('The flight number to check'),
        }),
        execute: async ({ flight }) => {
          return {
            flight,
            status: 'delayed',
            departure_time: '12 PM',
            delay_minutes: 120,
          };
        },
      }),
      book_taxi: tool({
        description: 'Book a taxi for a specific time',
        inputSchema: z.object({
          time: z.string().describe('Time to book the taxi'),
        }),
        execute: async ({ time }) => {
          return {
            booking_status: 'success',
            pickup_time: time,
            confirmation: 'TAXI-12345',
          };
        },
      }),
    },
    prompt:
      'Check flight status for AA100 and book a taxi 2 hours before if delayed.',
    onStepFinish: ({ toolCalls, toolResults }) => {
      if (toolCalls) {
        console.log(`\n  Tool calls: ${toolCalls.length}`);
        toolCalls.forEach(call => {
          const sig = call.providerMetadata?.google?.thoughtSignature;
          console.log(
            `    ${call.toolName}: ${
              sig && typeof sig === 'string'
                ? 'Signature: ' +
                  sig.substring(0, 50) +
                  '... (length: ' +
                  sig.length +
                  ')'
                : 'No signature (may be parallel call or non-Gemini 3)'
            }`,
          );
        });
      }
      if (toolResults) {
        console.log(`\n  Tool results: ${toolResults.length}`);
        toolResults.forEach(result => {
          const sig = result.providerMetadata?.google?.thoughtSignature;
          console.log(
            `    ${result.toolName}: ${
              sig && typeof sig === 'string'
                ? 'Signature preserved: ' + sig.substring(0, 50) + '...'
                : 'No signature'
            }`,
          );
        });
      }
    },
  });

  console.log('Turn 1 response:');
  for await (const chunk of turn1.stream) {
    if (chunk.type === 'text-delta') {
      process.stdout.write(chunk.text);
    } else if (chunk.type === 'tool-call') {
      console.log(`\n  [Stream] Tool call: ${chunk.toolName}`);
      if (chunk.providerMetadata?.google?.thoughtSignature) {
        console.log(`Thought signature in stream event FOUND!`);
      }
    }
  }

  const response1 = await turn1.response;
  console.log('\n\n=== Messages after Turn 1 ===');

  response1.messages.forEach((msg, i) => {
    if (msg.role === 'assistant' && typeof msg.content !== 'string') {
      console.log(`Message ${i} (assistant):`);
      msg.content.forEach(part => {
        if (part.type === 'tool-call') {
          const sig = part.providerOptions?.google?.thoughtSignature;
          console.log(
            `  tool-call ${part.toolName}: ${
              sig && typeof sig === 'string'
                ? 'Signature: ' + sig.substring(0, 40) + '...'
                : 'No signature'
            }`,
          );
        }
      });
    }
    if (msg.role === 'tool') {
      console.log(`Message ${i} (tool):`);
      msg.content.forEach(part => {
        if (part.type === 'tool-result') {
          const sig = part.providerOptions?.google?.thoughtSignature;
          console.log(
            `  tool-result ${part.toolName}: ${
              sig && typeof sig === 'string'
                ? 'Signature: ' + sig.substring(0, 40) + '...'
                : 'No signature'
            }`,
          );
        }
      });
    }
  });

  console.log('\n\n=== Turn 2: Continue with follow-up question ===\n');

  const messagesForTurn2: ModelMessage[] = [
    {
      role: 'user',
      content:
        'Check flight status for AA100 and book a taxi 2 hours before if delayed.',
    },
    ...response1.messages,
    {
      role: 'user',
      content: 'What was the taxi confirmation number?',
    },
  ];

  try {
    const turn2 = streamText({
      model,
      messages: messagesForTurn2,
      tools: {
        check_flight: tool({
          description: 'Gets the current status of a flight',
          inputSchema: z.object({
            flight: z.string(),
          }),
          execute: async ({ flight }) => ({ flight, status: 'on-time' }),
        }),
        book_taxi: tool({
          description: 'Book a taxi',
          inputSchema: z.object({
            time: z.string(),
          }),
          execute: async ({ time }) => ({ time, status: 'booked' }),
        }),
      },
    });

    console.log('Turn 2 response:');
    for await (const chunk of turn2.stream) {
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      }
    }
  } catch (error) {
    console.error(error);
  }

  console.log('\n\n=== Parallel Function Calling Test ===\n');

  const parallelTest = streamText({
    model,
    tools: {
      get_weather: tool({
        description: 'Get weather for a location',
        inputSchema: z.object({
          location: z.string(),
        }),
        execute: async ({ location }) => ({
          location,
          temp: location === 'Paris' ? '15C' : '12C',
          condition: 'cloudy',
        }),
      }),
    },
    prompt: 'Check the weather in Paris and London.',
    onStepFinish: ({ toolCalls }) => {
      if (toolCalls && toolCalls.length > 1) {
        console.log('\n  Parallel tool calls detected:');
        toolCalls.forEach((call, i) => {
          const sig = call.providerMetadata?.google?.thoughtSignature;
          const hasSignature = sig && typeof sig === 'string';
          console.log(
            `    [${i}] ${call.toolName}(${JSON.stringify(call.input)}): ${
              hasSignature
                ? 'Has signature'
                : i === 0
                  ? 'Missing (expected on first)'
                  : 'No signature (expected for parallel)'
            }`,
          );
        });
      }
    },
  });

  console.log('Parallel test response:');
  for await (const chunk of parallelTest.stream) {
    if (chunk.type === 'text-delta') {
      process.stdout.write(chunk.text);
    }
  }
});
