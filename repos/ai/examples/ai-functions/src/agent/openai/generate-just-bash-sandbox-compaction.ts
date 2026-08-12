import {
  type ModelMessage,
  type PrepareStepFunction,
  generateText,
  isStepCount,
  pruneMessages,
} from 'ai';
import { run } from '../../lib/run';
import { anthropic } from '@ai-sdk/anthropic';
import { createJustBashSandbox } from '@ai-sdk/sandbox-just-bash';
import { openai } from '@ai-sdk/openai';

const COMPACTION_THRESHOLD = 8000;
const estimateTokens = (messages: ModelMessage[]) => {
  return JSON.stringify(messages).length / 4;
};

const compactMessages: PrepareStepFunction<{
  bash: ReturnType<typeof anthropic.tools.bash_20250124>;
}> = ({ messages, stepNumber }) => {
  console.log('\nStep number:', stepNumber);

  const tokenCount = estimateTokens(messages);
  console.log('Estimated token count:', tokenCount);

  if (tokenCount > COMPACTION_THRESHOLD) {
    console.log('Compacting messages...');
    return {
      // message changes persist over steps now
      messages: pruneMessages({
        messages,
        reasoning: 'all',
        toolCalls: 'before-last-2-messages',
        emptyMessages: 'remove',
      }),
    };
  }
};

run(async () => {
  const sandboxSession = await createJustBashSandbox({
    overlayRoot: process.cwd(),
  }).createSession();

  const result = await generateText({
    model: openai('gpt-5.5'),
    instructions:
      'You have access to a filesystem. Details: ' + sandboxSession.description,
    prompt: 'Read every .ts file in this directory',
    experimental_sandbox: sandboxSession.restricted(),
    tools: {
      bash: anthropic.tools.bash_20250124(),
    },
    stopWhen: isStepCount(10),
    prepareStep: compactMessages,
  });

  console.log(result.text);
});
