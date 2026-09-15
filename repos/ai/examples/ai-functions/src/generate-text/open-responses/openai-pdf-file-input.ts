import { createOpenResponses } from '@ai-sdk/open-responses';
import { generateText } from 'ai';
import { run } from '../../lib/run';

const openResponses = createOpenResponses({
  name: 'openai',
  url: 'https://api.openai.com/v1/responses',
  apiKey: process.env.OPENAI_API_KEY,
});

run(async () => {
  const result = await generateText({
    model: openResponses('gpt-4.1-nano'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What text does this PDF contain? Reply with just the text content, nothing else.',
          },
          {
            type: 'file',
            data: new URL(
              'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            ),
            mediaType: 'application/pdf',
          },
        ],
      },
    ],
  });

  console.log(JSON.stringify(result.response.body, null, 2));
});
