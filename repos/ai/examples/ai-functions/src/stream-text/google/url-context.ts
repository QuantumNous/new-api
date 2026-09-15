import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: google('gemini-2.5-flash'),
    prompt: `Based on the document: https://ai.google.dev/gemini-api/docs/url-context#limitations.
            Answer this question: How many links we can consume in one request?`,
    tools: {
      url_context: google.tools.urlContext({}),
    },
  });

  for await (const part of result.stream) {
    if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    }

    if (part.type === 'source' && part.sourceType === 'url') {
      console.log('\x1b[36m%s\x1b[0m', 'Source');
      console.log('ID:', part.id);
      console.log('Title:', part.title);
      console.log('URL:', part.url);
      console.log();
    }
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
