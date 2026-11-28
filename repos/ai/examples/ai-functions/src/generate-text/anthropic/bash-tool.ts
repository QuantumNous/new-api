import { anthropic } from '@ai-sdk/anthropic';
import { generateText, isStepCount } from 'ai';
import { run } from '../../lib/run';
import { LocalSandboxSession } from '../../sandbox/local-sandbox';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-opus-4-7'),
    tools: {
      bash: anthropic.tools.bash_20250124(),
    },
    experimental_sandbox: new LocalSandboxSession({
      rootDirectory: `${process.env.HOME}/Downloads`,
    }),
    stopWhen: isStepCount(2),
    prompt: 'List the files in my home directory.',
  });

  console.log(result.text);
});
