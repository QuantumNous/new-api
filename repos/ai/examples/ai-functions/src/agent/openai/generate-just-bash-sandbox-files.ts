import { createJustBashSandbox } from '@ai-sdk/sandbox-just-bash';
import { run } from '../../lib/run';
import { sandboxAgent } from './sandbox-agent';

run(async () => {
  const sandboxSession = await createJustBashSandbox({
    overlayRoot: process.cwd(),
  }).createSession();

  const result = await sandboxAgent.generate({
    prompt:
      'Write a haiku about TypeScript to a file named "haiku.txt", then read it back and summarize what it says.',
    experimental_sandbox: sandboxSession.restricted(),
  });

  console.log(result.text);
});
