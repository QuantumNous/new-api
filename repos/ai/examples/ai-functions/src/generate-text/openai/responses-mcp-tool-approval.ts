import { createOpenAI } from '@ai-sdk/openai';
import {
  generateText,
  isStepCount,
  type ModelMessage,
  type ToolApprovalResponse,
} from 'ai';
import * as readline from 'node:readline/promises';
import { run } from '../../lib/run';

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const openai = createOpenAI();

run(async () => {
  const messages: ModelMessage[] = [];
  let approvals: ToolApprovalResponse[] = [];

  while (true) {
    messages.push(
      approvals.length > 0
        ? { role: 'tool', content: approvals }
        : { role: 'user', content: await terminal.question('You:\n') },
    );

    if (approvals.length === 0) {
      const lastMessage = messages[messages.length - 1];
      if (
        lastMessage.role === 'user' &&
        typeof lastMessage.content === 'string' &&
        lastMessage.content.toLowerCase() === 'exit'
      ) {
        terminal.close();
        break;
      }
    }

    approvals = [];

    const result = await generateText({
      model: openai.responses('gpt-5-mini'),
      instructions:
        'You are a helpful assistant that can shorten links. ' +
        'Use the MCP tools available to you to shorten links when needed. ' +
        'When a tool execution is not approved by the user, do not retry it. ' +
        'Just say that the tool execution was not approved.',
      tools: {
        mcp: openai.tools.mcp({
          serverLabel: 'zip1',
          serverUrl: 'https://zip1.io/mcp',
          serverDescription: 'Link shortener',
          requireApproval: 'always',
        }),
      },
      messages,
      stopWhen: isStepCount(10),
    });

    // Log raw response for debugging
    console.log('\n=== RAW RESPONSE ===');
    console.log('Steps:', result.steps.length);
    for (const [i, step] of result.steps.entries()) {
      console.log(`\n--- Step ${i + 1} ---`);
      console.log(
        'Content parts:',
        step.content.map(p => p.type),
      );
      for (const part of step.content) {
        if (
          part.type === 'tool-approval-request' ||
          part.type === 'tool-call' ||
          part.type === 'tool-result' ||
          part.type === 'tool-error'
        ) {
          console.log(`Tool ${part.type}:`, JSON.stringify(part, null, 2));
        }
      }
    }
    console.log('\n=== END RAW RESPONSE ===\n');

    for (const part of result.content) {
      if (part.type === 'tool-approval-request') {
        const answer = await terminal.question(
          `\nApprove MCP tool call? (y/n): `,
        );
        approvals.push({
          type: 'tool-approval-response',
          approvalId: part.approvalId,
          approved:
            answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes',
        });
      } else if (part.type === 'text') {
        console.log(`\nAssistant:\n${part.text}`);
      }
    }

    messages.push(...result.responseMessages);
  }
});
