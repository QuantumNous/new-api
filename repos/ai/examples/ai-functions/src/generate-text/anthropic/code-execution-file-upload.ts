import { anthropic } from '@ai-sdk/anthropic';
import { generateText, uploadFile } from 'ai';
import { run } from '../../lib/run';
import * as fs from 'fs';

run(async () => {
  const { providerReference } = await uploadFile({
    api: anthropic.files(),
    data: fs.readFileSync('./data/sample.csv'),
    filename: 'sample.csv',
    mediaType: 'text/csv',
  });

  const result = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    tools: {
      code_execution: anthropic.tools.codeExecution_20250825(),
    },
    include: {
      responseBody: true,
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this CSV data and calculate the total profit and average monthly revenue.',
          },
          {
            type: 'file',
            mediaType: 'text/csv',
            data: { type: 'reference', reference: providerReference },
            providerOptions: {
              anthropic: { containerUpload: true },
            },
          },
        ],
      },
    ],
  });

  console.log(JSON.stringify(result.response.body, null, 2));
});
