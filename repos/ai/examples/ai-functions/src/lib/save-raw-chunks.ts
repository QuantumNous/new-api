import type { StreamTextResult } from 'ai';
import fs from 'fs';

export async function saveRawChunks({
  result,
  filename,
}: {
  result: StreamTextResult<any, any, any>;
  filename: string;
}) {
  const rawChunks: unknown[] = [];
  for await (const chunk of result.stream) {
    if (chunk.type === 'raw') {
      rawChunks.push(chunk.rawValue);
    }
  }

  fs.writeFileSync(
    `output/${filename}.chunks.txt`,
    rawChunks.map(chunk => JSON.stringify(chunk)).join('\n'),
  );
}
