import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { generateText } from 'ai';
import 'dotenv/config';
import fs from 'fs';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Describe the image in detail.',
          },
          {
            type: 'file',
            mediaType: 'image',
            data: fs.readFileSync('./data/comic-cat.png'),
          },
        ],
      },
    ],
  });

  console.log('Response:', result.text);
  console.log();
  console.log('Finish reason:', result.finishReason);
  console.log('Usage:', result.usage);
});
