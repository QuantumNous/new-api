import { streamText } from 'ai';
import { registry } from './setup-registry';
import { run } from '../lib/run';

run(async () => {
  const result = streamText({
    model: registry.languageModel('xai:grok-4.5'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
});
