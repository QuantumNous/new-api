import { createOpenResponses } from '@ai-sdk/open-responses';
import { generateText, type ModelMessage } from 'ai';
import * as readline from 'node:readline/promises';
import { run } from '../../lib/run';
import { weatherTool } from '../../tools/weather-tool';

const lmstudio = createOpenResponses({
  name: 'lmstudio',
  url: 'http://localhost:1234/v1/responses',
});

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
        model: lmstudio('zai-org/glm-4.7-flash'),
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
