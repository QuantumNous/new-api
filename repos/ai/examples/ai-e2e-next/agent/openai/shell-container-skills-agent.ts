import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
import { readFileSync } from 'fs';
import { join } from 'path';

const skillZip = readFileSync(
  join(process.cwd(), 'data', 'island-rescue-skill.zip'),
).toString('base64');

export const openaiShellContainerSkillsAgent = new ToolLoopAgent({
  model: openai.responses('gpt-5.4'),
  instructions:
    'You have access to a shell tool running in a hosted container. ' +
    'Commands are executed server-side by OpenAI. ' +
    'You also have access to skills installed in the container.',
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
});

export type OpenAIShellContainerSkillsMessage = InferAgentUIMessage<
  typeof openaiShellContainerSkillsAgent
>;
