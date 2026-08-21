import { generateText } from 'ai';

declare const model: any;
declare const tools: any;

await generateText({
  model,
  tools,
  prompt: 'Hello',
  experimental_onToolCallStart(event) {
    console.log(event.toolCall.toolName);
  },
});
