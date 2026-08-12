import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { readFileSync } from 'fs';
import { run } from '../../lib/run';

const skillZip = readFileSync('data/island-rescue-skill.zip').toString(
  'base64',
);

run(async () => {
  const result = await generateText({
    model: openai.responses('gpt-5.4'),
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

  console.log('Result:', result.text);
});
