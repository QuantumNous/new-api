import { openai } from '@ai-sdk/openai';
import {
  generateText,
  isStepCount,
  tool,
  type ModelMessage,
  type ToolApprovalResponse,
} from 'ai';
import * as readline from 'node:readline/promises';
import { z } from 'zod/v4';
import { run } from '../../lib/run';

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const weatherTool = tool({
  description: 'Get the weather in a location',
  inputSchema: z.object({
    location: z.string().describe('The location to get the weather for'),
  }),
  execute: async ({ location }) => ({
    location,
    temperature: 72 + Math.floor(Math.random() * 21) - 10,
  }),
});

run(async () => {
  const messages: ModelMessage[] = [];
  let approvals: ToolApprovalResponse[] = [];

  while (true) {
    messages.push(
      approvals.length > 0
        ? { role: 'tool', content: approvals }
        : { role: 'user', content: await terminal.question('You:\n') },
    );

    approvals = [];

    const result = await generateText({
      model: openai('gpt-5.4-mini'),
      // context engineering required to make sure the model does not retry
      // the tool execution if it is not approved for a particular tool call:
      instructions:
        'When a tool call was not approved by the user, ' +
        'do not retry the tool call with the same input.' +
        'Just say that the tool execution was not approved.' +
        'You can call a denied tool call with a different input.',
      tools: { weather: weatherTool },
      toolApproval: ({ toolCall, tools, toolsContext, messages }) => {
        if (!toolCall.dynamic && toolCall.toolName === 'weather') {
          const locationLower = toolCall.input.location.toLowerCase();
          if (
            locationLower.includes('san francisco') ||
            locationLower === 'sf'
          ) {
            return 'approved';
          }

          if (locationLower.includes('new york') || locationLower === 'nyc') {
            return { type: 'denied', reason: 'blocked by policy' };
          }

          return 'user-approval';
        }
      },
      messages,
      stopWhen: isStepCount(5),
    });

    for (const step of result.steps) {
      for (const part of step.content) {
        switch (part.type) {
          case 'text': {
            process.stdout.write(`\nAssistant:\n`);
            process.stdout.write(part.text);
            break;
          }

          case 'tool-approval-request': {
            if (
              part.toolCall.toolName === 'weather' &&
              !part.toolCall.dynamic &&
              !part.isAutomatic
            ) {
              const answer = await terminal.question(
                `\nCan I retrieve the weather for ${part.toolCall.input.location} (y/n)?`,
              );

              approvals.push({
                type: 'tool-approval-response',
                approvalId: part.approvalId,
                approved:
                  answer.toLowerCase() === 'y' ||
                  answer.toLowerCase() === 'yes',
              });
            }
            break;
          }

          case 'tool-approval-response': {
            if (
              part.toolCall.toolName === 'weather' &&
              !part.toolCall.dynamic
            ) {
              process.stdout.write(
                `\nWeather tool execution for ${part.toolCall.input.location} was automatically ${
                  part.approved
                    ? '\x1b[32mapproved\x1b[0m' // dark green
                    : '\x1b[31mdenied\x1b[0m' // dark red
                }.\n`,
              );
              if (part.reason != null) {
                process.stdout.write(`Reason: ${part.reason}\n`);
              }
            }
            break;
          }
        }
      }
    }

    process.stdout.write('\n\n');

    messages.push(...result.responseMessages);
  }
});
