import { huggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: huggingFace.responses('deepseek-ai/DeepSeek-V3-0324'),
    prompt:
      'What are the latest developments in artificial intelligence research? Include sources.',
  });

  console.log(result.text);
  console.log();

  if (result.content) {
    const sources = result.content.filter(part => part.type === 'source');
    if (sources.length > 0) {
      console.log('Sources:');
      sources.forEach((source, index) => {
        if (source.type === 'source' && source.sourceType === 'url') {
          console.log(
            `${index + 1}. ${source.title || 'Untitled'}: ${source.url}`,
          );
        }
      });
    }
  }
});
