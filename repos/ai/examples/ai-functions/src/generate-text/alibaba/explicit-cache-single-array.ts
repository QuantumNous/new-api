import { alibaba, type AlibabaUsage } from '@ai-sdk/alibaba';
import { generateText } from 'ai';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { run } from '../../lib/run';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

run(async () => {
  const longUserContent = readFileSync(
    join(__dirname, '../../../data/compaction-data.txt'),
    'utf-8',
  );

  console.log('Request with part-level cache_control on user message...\n');

  const result = await generateText({
    model: alibaba('qwen-plus'),
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: longUserContent + '\n\nSummarize the above in one sentence.',
            providerOptions: {
              alibaba: {
                cache_control: { type: 'ephemeral' },
              },
            },
          },
        ],
      },
    ],
  });

  console.log('Text:', result.text.substring(0, 50) + '...');
  console.log('Usage:', result.usage);

  const raw = result.usage.raw as AlibabaUsage;
  const cacheCreated =
    raw.prompt_tokens_details?.cache_creation_input_tokens || 0;
  const cacheHit = raw.prompt_tokens_details?.cached_tokens || 0;

  console.log();
  if (cacheCreated > 0 || cacheHit > 0) {
    console.log(
      `SUCCESS: Part-level cache_control was applied (created: ${cacheCreated}, hit: ${cacheHit})`,
    );
  } else {
    console.log(
      'FAILED: Part-level cache_control was not applied - cache_control likely dropped by shortcut path',
    );
  }
});
