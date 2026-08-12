import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent } from 'ai';
import {
  sandboxReadTextFileTool,
  sandboxWriteTextFileTool,
} from '../../tools/sandbox-file-tool';
import { sandboxShellTool } from '../../tools/sandbox-shell-tool';

export const sandboxAgent = new ToolLoopAgent({
  model: openai('gpt-5.5'),

  tools: {
    shell: sandboxShellTool(),
    readTextFile: sandboxReadTextFileTool(),
    writeTextFile: sandboxWriteTextFileTool(),
  },

  prepareCall: ({ experimental_sandbox: sandbox, ...rest }) => ({
    ...rest,
    instructions:
      `You are a helpful assistant that can run shell commands and read/write text files.\n` +
      `You are operating in the following sandbox: ${sandbox?.description}`,
  }),
});
