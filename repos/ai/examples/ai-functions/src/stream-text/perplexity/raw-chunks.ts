import { perplexity } from '@ai-sdk/perplexity';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: perplexity('sonar-reasoning'),
    prompt: 'Count from 1 to 3 slowly.',
    include: {
      rawChunks: true,
    },
  });

  let textChunkCount = 0;
  let rawChunkCount = 0;

  for await (const chunk of result.stream) {
    if (chunk.type === 'text-delta') {
      textChunkCount++;
      console.log('Text chunk', textChunkCount, ':', chunk.text);
    } else if (chunk.type === 'raw') {
      rawChunkCount++;
      console.log(
        'Raw chunk',
        rawChunkCount,
        ':',
        JSON.stringify(chunk.rawValue),
      );
    }
  }

  console.log();
  console.log('Text chunks:', textChunkCount);
  console.log('Raw chunks:', rawChunkCount);
  console.log('Final text:', await result.text);
});
