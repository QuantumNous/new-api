import { generateText } from 'ai';

declare const model: any;

await generateText({
  model,
  prompt: 'Hello',
  experimental_telemetry: {
    functionId: 'story-agent',
  },
});
