import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText, isStepCount, type ModelMessage } from 'ai';
import * as readline from 'node:readline/promises';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

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
      model: amazonBedrock('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
      tools: { weatherTool },
      instructions: `You are a helpful, respectful and honest assistant.`,
      messages,
      stopWhen: isStepCount(5),
      reasoning: 'medium',
    });

    for (const step of steps) {
      console.log(step);
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
