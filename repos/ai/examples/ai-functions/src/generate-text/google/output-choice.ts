import { google } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: google('gemini-2.5-pro'),
    output: Output.choice({
      options: ['action', 'comedy', 'drama', 'horror', 'sci-fi'],
    }),
    prompt:
      'Classify the genre of this movie plot: ' +
      '"A group of astronauts travel through a wormhole in search of a ' +
      'new habitable planet for humanity."',
  });

  console.log(result.output);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
