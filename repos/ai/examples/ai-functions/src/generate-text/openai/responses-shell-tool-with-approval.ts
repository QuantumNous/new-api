import { openai } from '@ai-sdk/openai';
import {
  generateText,
  isStepCount,
  type ModelMessage,
  type ToolApprovalResponse,
} from 'ai';
import * as readline from 'node:readline/promises';
import { executeShellCommand } from '../../lib/shell-executor';
import { run } from '../../lib/run';

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

run(async () => {
  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: 'List the files in my current directory',
    },
  ];
  let approvals: ToolApprovalResponse[] = [];

  while (true) {
    if (approvals.length > 0) {
      messages.push({ role: 'tool', content: approvals });
      approvals = [];
    }

    const result = await generateText({
      model: openai.responses('gpt-5.1'),
      tools: {
        shell: openai.tools.shell({
          needsApproval: true,
          execute: async ({ action }) => {
            const outputs = await Promise.all(
              action.commands.map(command =>
                executeShellCommand(command, action.timeoutMs),
              ),
            );

            return { output: outputs };
          },
        }),
      },
      messages,
      stopWhen: isStepCount(5),
      instructions:
        'You have access to a shell tool that can execute commands on the local filesystem. ' +
        'Use the shell tool when you need to perform file operations or run commands. ' +
        'When a tool execution is not approved by the user, do not retry it. ' +
        'Just say that the tool execution was not approved.',
    });

    process.stdout.write('\nAssistant: ');
    for (const part of result.content) {
      if (part.type === 'text') {
        process.stdout.write(part.text);
      }

      if (part.type === 'tool-approval-request') {
        const input =
          typeof part.toolCall.input === 'string'
            ? JSON.parse(part.toolCall.input)
            : part.toolCall.input;
        const commands =
          (input as { action?: { commands?: string[] } }).action?.commands ||
          [];

        console.log('\nShell command approval required:');
        commands.forEach((cmd, index) => {
          console.log(`  ${index + 1}. ${cmd}`);
        });

        const answer = await terminal.question(
          '\nProceed with execution? [y/N] ',
        );

        approvals.push({
          type: 'tool-approval-response',
          approvalId: part.approvalId,
          approved:
            answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes',
        });
      }
    }

    process.stdout.write('\n\n');

    messages.push(...result.responseMessages);

    if (approvals.length === 0 && result.finishReason !== 'tool-calls') {
      break;
    }
  }

  terminal.close();
});
