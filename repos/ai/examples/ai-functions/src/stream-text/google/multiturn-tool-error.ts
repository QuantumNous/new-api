import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { run } from '../../lib/run';

run(async () => {
  console.log('testing multi-turn conversation with tool error\n');
  console.log(
    'this test verifies that thoughtSignatures from gemini 3 pro are:',
  );
  console.log('1. extracted from google api responses (raw chunks)');
  console.log('2. preserved through tool execution (including errors)');
  console.log('3. included in conversation history for multi-turn context\n');

  console.log('=== turn 1: tool call that will naturally fail ===');
  const turn1 = streamText({
    model: google('gemini-3.1-pro-preview'),
    tools: {
      readuserdata: tool({
        description: 'read user data from file',
        inputSchema: z.object({
          userId: z.string(),
        }),
        execute: async ({ userId }) => {
          const data = await readFile(
            `/nonexistent/user-${userId}.json`,
            'utf-8',
          );
          return JSON.parse(data);
        },
      }),
    },
    prompt: 'read data for user 123',
    include: {
      rawChunks: true,
    },
    onStepFinish: ({ toolCalls, toolResults }) => {
      if (toolCalls) {
        console.log(`\ntool calls: ${toolCalls.length}`);
        toolCalls.forEach(call => {
          const sig = call.providerMetadata?.google?.thoughtSignature;
          console.log(
            `  ${call.toolName}: ${sig && typeof sig === 'string' ? 'signature: ' + sig.substring(0, 40) + '... (length: ' + sig.length + ')' : '❌ NO SIGNATURE'}`,
          );
        });
      }
      if (toolResults) {
        console.log(`\ntool results: ${toolResults.length}`);
        toolResults.forEach(result => {
          const sig = result.providerMetadata?.google?.thoughtSignature;
          console.log(
            `  ${result.toolName} result: ${sig && typeof sig === 'string' ? '✓ signature preserved: ' + sig.substring(0, 40) + '... (length: ' + sig.length + ')' : '❌ NO SIGNATURE'}`,
          );
        });
      }
    },
  });

  console.log('\nturn 1 response:');

  let rawChunkCount = 0;
  for await (const chunk of turn1.stream) {
    if (chunk.type === 'text-delta') {
      process.stdout.write(chunk.text);
    } else if (chunk.type === 'raw') {
      rawChunkCount++;
      const raw = chunk.rawValue as any;
      if (raw?.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
        console.log(
          `\n[raw chunk ${rawChunkCount}] google response with functionCall:`,
        );
        const part = raw.candidates[0].content.parts[0];
        console.log(`  functionCall.name: ${part.functionCall.name}`);
        console.log(
          `  thoughtSignature: ${part.thoughtSignature ? part.thoughtSignature.substring(0, 40) + '... ✓' : 'not present'}`,
        );
      }
    }
  }

  const response1 = await turn1.response;
  console.log('\n\nmessages after turn 1:');
  console.log(JSON.stringify(response1.messages, null, 2));

  console.log('\n\n=== turn 2: continue with deeper analysis request ===');

  const messagesForTurn2 = [
    {
      role: 'user' as const,
      content:
        'analyze user 123 by reading their data and calculating their metrics',
    },
    ...response1.messages,
    {
      role: 'user' as const,
      content:
        'based on those errors, what is the root cause and what should we investigate next?',
    },
  ];

  console.log(
    '\nverifying thoughtSignatures in message history sent to turn 2:',
  );
  messagesForTurn2.forEach((msg, i) => {
    if (msg.role === 'assistant' && typeof msg.content !== 'string') {
      console.log(`message ${i} (assistant):`);
      msg.content.forEach(part => {
        if (part.type === 'tool-call') {
          const sig = part.providerOptions?.google?.thoughtSignature;
          console.log(
            `  tool-call ${part.toolName}: ${sig && typeof sig === 'string' ? '✓ signature: ' + sig.substring(0, 40) + '... (length: ' + sig.length + ')' : '❌ NO SIGNATURE - WILL FAIL'}`,
          );
        }
      });
    }
    if (msg.role === 'tool') {
      console.log(`message ${i} (tool):`);
      msg.content.forEach(part => {
        if (part.type === 'tool-result') {
          const sig = part.providerOptions?.google?.thoughtSignature;
          console.log(
            `  tool-result ${part.toolName}: ${sig && typeof sig === 'string' ? '✓ signature: ' + sig.substring(0, 40) + '... (length: ' + sig.length + ')' : '❌ NO SIGNATURE - WILL FAIL'}`,
          );
        }
      });
    }
  });

  try {
    const turn2 = streamText({
      model: google('gemini-3.1-pro-preview'),
      messages: messagesForTurn2,
      include: {
        rawChunks: true,
      },
      tools: {
        readuserdata: tool({
          description: 'read user data from file',
          inputSchema: z.object({
            userId: z.string(),
          }),
          execute: async ({ userId }) => {
            return { userId, name: 'test user', data: 'mock data' };
          },
        }),
      },
    });

    console.log('\nturn 2 response:');

    for await (const chunk of turn2.stream) {
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      }
    }

    console.log('\n\nturn 2 succeeded!');

    const response2 = await turn2.response;

    console.log('\n\nmessages after turn 2:');
    console.log(JSON.stringify(response2.messages, null, 2));

    console.log('\n\n=== turn 3: force successful tool call ===');

    const messagesForTurn3 = [
      {
        role: 'user' as const,
        content:
          'analyze user 123 by reading their data and calculating their metrics',
      },
      ...response1.messages,
      {
        role: 'user' as const,
        content:
          'based on those errors, what is the root cause and what should we investigate next?',
      },
      ...response2.messages,
      {
        role: 'user' as const,
        content:
          'try calling readuserdata now with userId 456. the system has been fixed.',
      },
    ];

    const turn3 = streamText({
      model: google('gemini-3.1-pro-preview'),
      messages: messagesForTurn3,
      include: {
        rawChunks: true,
      },
      tools: {
        readuserdata: tool({
          description: 'read user data from file',
          inputSchema: z.object({
            userId: z.string(),
          }),
          execute: async ({ userId }) => {
            return {
              userId,
              name: 'john doe',
              email: 'john@example.com',
              plan: 'premium',
            };
          },
        }),
      },
      onStepFinish: ({ toolCalls, toolResults }) => {
        if (toolCalls) {
          console.log(`\nturn 3 tool calls: ${toolCalls.length}`);
          toolCalls.forEach(call => {
            const sig = call.providerMetadata?.google?.thoughtSignature;
            console.log(
              `  ${call.toolName}: ${sig && typeof sig === 'string' ? '✓ signature: ' + sig.substring(0, 40) + '... (length: ' + sig.length + ')' : '❌ NO SIGNATURE'}`,
            );
          });
        }
        if (toolResults) {
          console.log(`\nturn 3 tool results: ${toolResults.length}`);
          toolResults.forEach(result => {
            const sig = result.providerMetadata?.google?.thoughtSignature;
            console.log(
              `  ${result.toolName} result: ${sig && typeof sig === 'string' ? '✓ signature preserved: ' + sig.substring(0, 40) + '... (length: ' + sig.length + ')' : '❌ NO SIGNATURE - SUCCESS CASE BROKEN'}`,
            );
          });
        }
      },
    });

    console.log('\nturn 3 response:');

    for await (const chunk of turn3.stream) {
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      }
    }

    console.log('\n\nturn 3 succeeded!');

    console.log('\n\nmessages after turn 3:');
    console.log(JSON.stringify((await turn3.response).messages, null, 2));
  } catch (error) {
    console.error('\nFAILED with error:');
    console.error(error);
    if (
      error instanceof Error &&
      error.message?.includes('thought_signature')
    ) {
      console.error(
        'The thoughtSignature was not preserved in tool-result messages.',
      );
    }
    process.exit(1);
  }
});
