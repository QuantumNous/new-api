import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const openaiCompatible = createOpenAICompatible({
    baseURL: 'https://api.openai.com/v1',
    name: 'openai-compatible',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  });

  const result = streamText({
    model: openaiCompatible.completionModel('gpt-3.5-turbo-instruct'),
    prompt: 'Hello, World!',
    include: {
      rawChunks: true,
    },
  });

  let textChunkCount = 0;
  let rawChunkCount = 0;
  let otherChunkCount = 0;

  for await (const chunk of result.stream) {
    console.log('Chunk type:', chunk.type, 'Chunk:', JSON.stringify(chunk));

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
    } else {
      otherChunkCount++;
      console.log('Other chunk', otherChunkCount, ':', chunk.type);
    }
  }

  console.log();
  console.log('Text chunks:', textChunkCount);
  console.log('Raw chunks:', rawChunkCount);
  console.log('Other chunks:', otherChunkCount);
  console.log('Final text:', await result.text);
});
