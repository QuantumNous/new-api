import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, type ModelMessage } from 'ai';
import * as readline from 'node:readline/promises';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages: ModelMessage[] = [];

run(async () => {
  let toolResponseAvailable = false;

  while (true) {
    if (!toolResponseAvailable) {
      const userInput = await terminal.question('You: ');
      messages.push({ role: 'user', content: userInput });
    }

    const { text, toolCalls, toolResults, responseMessages } =
      await generateText({
        model: amazonBedrock('anthropic.claude-3-haiku-20240307-v1:0'),
        tools: { weatherTool },
        instructions: `You are a helpful, respectful and honest assistant. If the weather is requested use the `,
        messages,
      });

    toolResponseAvailable = false;

    if (text) {
      process.stdout.write(`\nAssistant: ${text}`);
    }

    for (const { toolName, input } of toolCalls) {
      process.stdout.write(
        `\nTool call: '${toolName}' ${JSON.stringify(input)}`,
      );
    }

    for (const { toolName, output } of toolResults) {
      process.stdout.write(
        `\nTool response: '${toolName}' ${JSON.stringify(output)}`,
      );
    }

    process.stdout.write('\n\n');

    messages.push(...responseMessages);

    toolResponseAvailable = toolCalls.length > 0;
  }
});
