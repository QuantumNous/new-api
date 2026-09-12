import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const model = amazonBedrock('us.anthropic.claude-sonnet-4-5-20250929-v1:0');

  const documentContent =
    'This is a sample text document for testing prompt cache effectiveness.\n\nThe key improvement: documents now have consistent names like document-01, document-02, etc. instead of random names, enabling proper prompt caching.';
  const documentData = Buffer.from(documentContent, 'utf-8').toString('base64');

  console.log('First request with documents:');
  const result1 = await generateText({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Please analyze these text documents:' },
          {
            type: 'file',
            data: documentData,
            mediaType: 'text/txt',
          },
          {
            type: 'file',
            data: documentData,
            mediaType: 'text/txt',
          },
        ],
      },
    ],
  });

  console.log('Response 1:', result1.text.slice(0, 100) + '...');

  console.log('\nSecond request with same documents:');
  const result2 = await generateText({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Please analyze these text documents:' },
          {
            type: 'file',
            data: documentData,
            mediaType: 'text/txt',
          },
          {
            type: 'file',
            data: documentData,
            mediaType: 'text/txt',
          },
        ],
      },
    ],
  });

  console.log('Response 2:', result2.text.slice(0, 100) + '...');

  console.log(
    '\nWith the fix, both requests will use the same document names:',
  );
  console.log('- First document: document-01');
  console.log('- Second document: document-02');
  console.log(
    'This enables effective prompt caching since document names are consistent!',
  );
});
