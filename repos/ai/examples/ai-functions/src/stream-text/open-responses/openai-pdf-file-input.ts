import { createOpenResponses } from '@ai-sdk/open-responses';
import { streamText } from 'ai';
import { run } from '../../lib/run';
import { saveRawChunks } from '../../lib/save-raw-chunks';

const openResponses = createOpenResponses({
  name: 'openai',
  url: 'https://api.openai.com/v1/responses',
  apiKey: process.env.OPENAI_API_KEY,
});

run(async () => {
  const result = streamText({
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
    includeRawChunks: true,
  });

  await saveRawChunks({
    result,
    filename: 'open-responses-openai-pdf-input-file',
  });

  console.log('Text:', await result.text);
  console.log('Usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
