import { generateText } from 'ai';

declare const model: any;
declare const tools: any;

await generateText({
  model,
  tools,
  prompt: 'Hello',
  experimental_onToolCallFinish(event) {
    console.log(event.toolCall.toolName);
  },
});
