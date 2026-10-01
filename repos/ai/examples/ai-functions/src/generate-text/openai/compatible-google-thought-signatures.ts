import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, tool, isStepCount, type ModelMessage } from 'ai';
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

  const tools = {
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
        };
      },
    }),
  };

  const result1 = await generateText({
    model,
    tools,
    prompt:
      'Check flight status for AA100 and book a taxi 2 hours before if delayed.',
    stopWhen: isStepCount(5),
    onStepFinish: ({ toolCalls, toolResults }) => {
      if (toolCalls) {
        toolCalls.forEach(call => {
          const sig = call.providerMetadata?.google?.thoughtSignature;
          console.log(
            `    Tool call ${call.toolName}: ${
              sig && typeof sig === 'string'
                ? 'Signature: ' + sig.substring(0, 50) + '...'
                : 'No signature'
            }`,
          );
        });
      }

      if (toolResults) {
        toolResults.forEach(result => {
          const sig = result.providerMetadata?.google?.thoughtSignature;
          console.log(
            `    Tool result ${result.toolName}: ${
              sig && typeof sig === 'string'
                ? 'Signature preserved'
                : 'No signature'
            }`,
          );
        });
      }
    },
  });

  console.log('\nFinal response:');
  console.log(result1.text);

  result1.responseMessages.forEach((msg, i) => {
    if (msg.role === 'assistant' && typeof msg.content !== 'string') {
      console.log(`Message ${i} (assistant):`);
      msg.content.forEach(part => {
        if (part.type === 'tool-call') {
          const sig = part.providerOptions?.google?.thoughtSignature;
          console.log(
            `  ${part.toolName}: ${sig ? 'Has signature' : 'No signature'}`,
          );
        }
      });
    }
  });

  console.log('\n\n=== Turn 2: Follow-up question ===\n');

  const messagesForTurn2: ModelMessage[] = [
    {
      role: 'user',
      content:
        'Check flight status for AA100 and book a taxi 2 hours before if delayed.',
    },
    ...result1.responseMessages,
    {
      role: 'user',
      content: 'Summarize what you did.',
    },
  ];

  try {
    const result2 = await generateText({
      model,
      messages: messagesForTurn2,
      tools,
      stopWhen: isStepCount(1),
    });

    console.log('Turn 2 response:');
    console.log(result2.text);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  console.log('\n\n=== Parallel Function Calling Test ===\n');

  const parallelResult = await generateText({
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
        }),
      }),
    },
    prompt: 'Check the weather in Paris and London.',
    stopWhen: isStepCount(2),
    onStepFinish: ({ toolCalls }) => {
      if (toolCalls && toolCalls.length > 1) {
        console.log('Parallel tool calls:');
        toolCalls.forEach((call, i) => {
          const sig = call.providerMetadata?.google?.thoughtSignature;
          console.log(
            `  [${i}] ${call.toolName}(${JSON.stringify(call.input)}): ${
              sig
                ? 'Has signature (expected only on first for Gemini 3)'
                : i === 0
                  ? 'Missing on first call'
                  : 'No signature (correct for parallel)'
            }`,
          );
        });
      }
    },
  });

  console.log('\nParallel test response:');
  console.log(parallelResult.text);
});
