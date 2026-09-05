import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';
import * as fs from 'fs';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    prompt:
      'Write a Python script to calculate fibonacci number' +
      ' and then execute it to find the 10th fibonacci number' +
      ' finally output data to excel file and python code.',
    tools: {
      code_execution: anthropic.tools.codeExecution_20250825(),
    },
  });

  console.dir(result.content, { depth: Infinity });

  const fileIdList = result.staticToolResults.flatMap(t => {
    if (
      t.toolName === 'code_execution' &&
      t.output.type === 'bash_code_execution_result'
    ) {
      return t.output.content.map(o => o.file_id);
    }
    return [];
  });

  await Promise.all(fileIdList.map(fileId => downloadFile(fileId)));
});

async function downloadFile(file: string) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    const infoUrl = `https://api.anthropic.com/v1/files/${file}`;
    const infoPromise = fetch(infoUrl, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'files-api-2025-04-14',
      },
    });

    const downloadUrl = `https://api.anthropic.com/v1/files/${file}/content`;
    const downloadPromise = fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'files-api-2025-04-14',
      },
    });

    const [infoResponse, downloadResponse] = await Promise.all([
      infoPromise,
      downloadPromise,
    ]);

    if (!infoResponse.ok) {
      throw new Error(
        `HTTP Error: ${infoResponse.status} ${infoResponse.statusText}`,
      );
    }

    const {
      filename,
    }: {
      type: 'file';
      id: string;
      size_bytes: number;
      created_at: Date;
      filename: string;
      mime_type: string;
      downloadable?: boolean;
    } = await infoResponse.json();

    if (!downloadResponse.ok) {
      throw new Error(
        `HTTP Error: ${downloadResponse.status} ${downloadResponse.statusText}`,
      );
    }

    // get as binary data
    const arrayBuffer = await downloadResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const outputPath = `output/${filename}`;

    fs.writeFileSync(outputPath, buffer);

    console.log(`file saved: ${outputPath}`);
    console.log(`file size: ${buffer.length} bytes`);

    return {
      path: outputPath,
      size: buffer.length,
    };
  } catch (error) {
    console.error('error:', error);
    throw error;
  }
}
