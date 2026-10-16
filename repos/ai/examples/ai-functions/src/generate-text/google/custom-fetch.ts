import { createGoogle } from '@ai-sdk/google';
import { generateText } from 'ai';
import { run } from '../../lib/run';

const google = createGoogle({
  // example fetch wrapper that logs the input to the API call:
  fetch: async (url, options) => {
    console.log('URL', url);
    console.log('Headers', JSON.stringify(options!.headers, null, 2));
    console.log(
      `Body ${JSON.stringify(JSON.parse(options!.body! as string), null, 2)}`,
    );
    return await fetch(url, options);
  },
});

run(async () => {
  const result = await generateText({
    model: google('gemini-2.5-pro'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result.text);
});
