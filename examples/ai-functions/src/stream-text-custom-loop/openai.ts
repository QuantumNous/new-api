import { openai } from '@ai-sdk/openai';
import {
  experimental_streamLanguageModelCall as streamLanguageModelCall,
  type Experimental_LanguageModelStreamPart as LanguageModelStreamPart,
  type AsyncIterableStream,
} from 'ai';
import { run } from '../lib/run';

run(async () => {
  const { stream }: { stream: AsyncIterableStream<LanguageModelStreamPart> } =
    await streamLanguageModelCall({
      model: openai('gpt-5.4'),
      prompt: 'How many people live in the capital of France?',
    });

  for await (const chunk of stream) {
    switch (chunk.type) {
      case 'model-call-start':
        console.log('MODEL CALL START');
        break;
      case 'model-call-end':
        console.log('MODEL CALL END');
        break;
      case 'text-delta':
        process.stdout.write(chunk.text);
        break;
      case 'text-end':
        console.log('');
        break;
    }
  }
});
