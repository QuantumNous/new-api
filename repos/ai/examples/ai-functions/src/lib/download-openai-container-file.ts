import 'dotenv/config';
import * as fs from 'fs';

export async function downloadOpenaiContainerFile(
  container: string,
  file: string,
) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const infoUrl = `https://api.openai.com/v1/containers/${container}/files/${file}`;
    const infoResponse = await fetch(infoUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!infoResponse.ok) {
      throw new Error(
        `HTTP Error: ${infoResponse.status} ${infoResponse.statusText}`,
      );
    }
    const {
      path,
    }: {
      id: string;
      object: string;
      created_at: number;
      bytes: number;
      container_id: string;
      path: string;
      source: string;
    } = await infoResponse.json();

    const filename = path.split('/').at(-1) || 'result-file';

    const downloadUrl = `https://api.openai.com/v1/containers/${container}/files/${file}/content`;
    const downloadResponse = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

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
    console.error('download failed', {
      op: 'downloadOpenaiContainerFile',
      container,
      file,
      error,
    });
    throw error;
  }
}
