import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { isStepCount, streamText } from 'ai';
import 'dotenv/config';
import { run } from '../../lib/run';

run(async () => {
  let editorContent = `# README

This is a sample README file for testing the text editor tool.
`;

  const result = streamText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    tools: {
      str_replace_editor: bedrockAnthropic.tools.textEditor_20241022({
        async execute({ command, path, old_str, new_str, insert_text }) {
          console.log(`Editor command: ${command}`);
          if (command === 'view') {
            return editorContent;
          }
          if (command === 'str_replace' && old_str && new_str) {
            editorContent = editorContent.replace(old_str, new_str);
            return editorContent;
          }
          if (command === 'insert' && insert_text) {
            editorContent = insert_text;
            return editorContent;
          }
          return editorContent;
        },
      }),
    },
    prompt: 'Update my README file to mention that this project uses AI SDK.',
    stopWhen: isStepCount(5),
  });

  for await (const part of result.stream) {
    if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    } else if (part.type === 'tool-call') {
      console.log(
        `\nTool call: ${part.toolName}(${JSON.stringify(part.input).substring(0, 100)}...)`,
      );
    } else if (part.type === 'tool-result') {
      console.log(`Tool result received`);
    }
  }

  console.log();
  console.log('Final editor content:', editorContent);
  console.log('Finish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);
});
