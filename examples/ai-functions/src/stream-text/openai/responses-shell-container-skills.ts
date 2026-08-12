import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { readFileSync } from 'fs';
import { run } from '../../lib/run';
import { saveRawChunks } from '../../lib/save-raw-chunks';

const skillZip = readFileSync('data/island-rescue-skill.zip').toString(
  'base64',
);

run(async () => {
  const result = streamText({
    model: openai.responses('gpt-5.6'),
    tools: {
      shell: openai.tools.shell({
        environment: {
          type: 'containerAuto',
          skills: [
            {
              type: 'inline',
              name: 'island-rescue',
              description: 'How to be rescued from a lonely island',
              source: {
                type: 'base64',
                mediaType: 'application/zip',
                data: skillZip,
              },
            },
          ],
        },
      }),
    },
    prompt:
      'You are trapped and lost on a lonely island in 1895. Find a way to get rescued!',
  });

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'text-delta': {
        process.stdout.write(chunk.text);
        break;
      }

      case 'tool-call': {
        console.log(
          `\x1b[32m\x1b[1mTool call:\x1b[22m ${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'tool-result': {
        console.log(
          `\x1b[32m\x1b[1mTool result:\x1b[22m ${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'error':
        console.error('Error:', chunk.error);
        break;
    }
  }
});
