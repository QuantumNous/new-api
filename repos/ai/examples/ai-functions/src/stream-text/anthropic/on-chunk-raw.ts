import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  console.log('=== onChunk with raw chunks enabled ===');

  let textChunkCount = 0;
  let rawChunkCount = 0;
  let otherChunkCount = 0;

  const result = streamText({
    model: anthropic('claude-3-haiku-20240307'),
    prompt:
      'Write a short poem about coding. Include reasoning about your creative process.',
    include: {
      rawChunks: true,
    },
    onChunk({ chunk }) {
      if (chunk.type === 'text-delta') {
        textChunkCount++;
        console.log('onChunk text:', chunk.text);
      } else if (chunk.type === 'raw') {
        rawChunkCount++;
        console.log('onChunk raw:', JSON.stringify(chunk.rawValue));
      } else {
        otherChunkCount++;
        console.log('onChunk other:', chunk.type);
      }
    },
  });

  for await (const textPart of result.textStream) {
  }

  console.log();
  console.log('Summary:');
  console.log('- Text chunks received in onChunk:', textChunkCount);
  console.log('- Raw chunks received in onChunk:', rawChunkCount);
  console.log('- Other chunks received in onChunk:', otherChunkCount);
  console.log('- Final text:', await result.text);
});
