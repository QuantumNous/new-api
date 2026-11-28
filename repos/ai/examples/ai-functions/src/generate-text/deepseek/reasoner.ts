import { deepSeek, DeepSeekLanguageModelChatOptions } from '@ai-sdk/deepseek';
import { generateText } from 'ai';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: deepSeek('deepseek-reasoner'),
    prompt: 'How many "r"s are in the word "strawberry"?',
  });

  print('Content:', result.content);
  print('Usage:', result.usage);
  print('Finish reason:', result.finishReason);
});
