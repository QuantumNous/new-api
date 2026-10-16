import { anthropic } from '@ai-sdk/anthropic';
import { streamText, uploadFile } from 'ai';
import { run } from '../../lib/run';
import * as fs from 'fs';
import { saveRawChunks } from '../../lib/save-raw-chunks';

run(async () => {
  const { providerReference } = await uploadFile({
    api: anthropic.files(),
    data: fs.readFileSync('./data/sample.csv'),
    filename: 'sample.csv',
    mediaType: 'text/csv',
  });

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    tools: {
      code_execution: anthropic.tools.codeExecution_20250825(),
    },
    include: {
      rawChunks: true,
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

  await saveRawChunks({
    result,
    filename: 'anthropic-code-execution-file-upload.1',
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta': {
        process.stdout.write(part.text);
        break;
      }

      case 'tool-call': {
        process.stdout.write(
          `\n\nTool call: '${part.toolName}'\nInput: ${JSON.stringify(part.input, null, 2)}\n`,
        );
        break;
      }

      case 'tool-result': {
        process.stdout.write(
          `\nTool result: '${part.toolName}'\nOutput: ${JSON.stringify(part.output, null, 2)}\n`,
        );
        break;
      }

      case 'error': {
        console.error('\n\nCode execution error:', part.error);
        break;
      }
    }
  }

  process.stdout.write('\n\n');
});
