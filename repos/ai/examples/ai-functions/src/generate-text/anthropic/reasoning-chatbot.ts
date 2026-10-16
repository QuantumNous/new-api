import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, isStepCount, type ModelMessage } from 'ai';
import * as readline from 'node:readline/promises';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

const anthropic = createAnthropic({
  // example fetch wrapper that logs the input to the API call:
  fetch: async (url, options) => {
    console.log('URL', url);
    console.log('Headers', JSON.stringify(options!.headers, null, 2));
    console.log(
      `Body ${JSON.stringify(JSON.parse(options!.body! as string), null, 2)}`,
    );
    return await fetch(url, options);
  },
});

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages: ModelMessage[] = [];

run(async () => {
  while (true) {
    const userInput = await terminal.question('You: ');
    messages.push({ role: 'user', content: userInput });

    const { steps, responseMessages } = await generateText({
      model: anthropic('claude-sonnet-4-5-20250929'),
      tools: { weatherTool },
      instructions: `You are a helpful, respectful and honest assistant.`,
      messages,
      stopWhen: isStepCount(5),
      reasoning: 'medium',
    });

    console.log('Assistant:');

    for (const step of steps) {
      if (step.reasoningText) {
        console.log(`\x1b[36m${step.reasoningText}\x1b[0m`);
      }

      if (step.text) {
        console.log(step.text);
      }

      if (step.toolCalls) {
        for (const toolCall of step.toolCalls) {
          console.log(
            `\x1b[33m${toolCall.toolName}\x1b[0m` +
              JSON.stringify(toolCall.input),
          );
        }
      }
    }

    console.log('\n');

    messages.push(...responseMessages);
  }
});
