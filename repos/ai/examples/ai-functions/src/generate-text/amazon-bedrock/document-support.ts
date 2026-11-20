import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { run } from '../../lib/run';

run(async () => {
  const model = amazonBedrock('us.anthropic.claude-sonnet-4-5-20250929-v1:0');

  const testCases = [
    {
      name: 'PDF',
      file: 'ai.pdf',
      mediaType: 'application/pdf',
    },
    {
      name: 'Plain Text',
      file: 'error-message.txt',
      mediaType: 'text/plain',
    },
    {
      name: 'CSV',
      data: 'Name,Age,City\nJohn,30,New York\nJane,25,Los Angeles',
      mediaType: 'text/csv',
    },
    {
      name: 'HTML',
      data: '<html><body><h1>Test Document</h1><p>This is a test HTML document.</p></body></html>',
      mediaType: 'text/html',
    },
    {
      name: 'Markdown',
      data: '# Test Document\n\nThis is a **test** markdown document with some content.',
      mediaType: 'text/markdown',
    },
    {
      name: 'XLSX (Excel)',
      file: 'aisdk.xlsx',
      mediaType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    {
      name: 'DOCX (Word)',
      file: 'sdk.docx',
      mediaType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  ];

  console.log('Testing all supported Bedrock document types:\n');

  for (const testCase of testCases) {
    console.log(`Testing ${testCase.name} support:`);

    try {
      let fileData: string;

      if (testCase.file) {
        const filePath = join(__dirname, '../../data', testCase.file);
        const fileBuffer = readFileSync(filePath);
        fileData = fileBuffer.toString('base64');
      } else {
        fileData = Buffer.from(testCase.data!, 'utf-8').toString('base64');
      }

      const result = await generateText({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Briefly describe what this document contains:',
              },
              {
                type: 'file',
                data: fileData,
                mediaType: testCase.mediaType,
              },
            ],
          },
        ],
      });

      console.log(`✓ ${testCase.name} processed successfully`);
      console.log(`  Response: ${result.text}`);
    } catch (error) {
      if (error instanceof Error) {
        console.log(`✗ ${testCase.name} failed: ${error.message}`);
      } else {
        console.log(`✗ ${testCase.name} failed with unknown error`);
      }
    }

    console.log('');
  }

  console.log('All supported document types tested!');
});
