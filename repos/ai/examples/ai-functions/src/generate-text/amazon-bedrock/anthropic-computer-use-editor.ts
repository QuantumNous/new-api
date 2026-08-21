import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { generateText, isStepCount } from 'ai';
import 'dotenv/config';
import { run } from '../../lib/run';

run(async () => {
  let editorContent = '## README\nThis is a test file.';

  const result = await generateText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    tools: {
      str_replace_editor: bedrockAnthropic.tools.textEditor_20241022({
        async execute({ command, path, old_str, new_str, insert_text }) {
          console.log(`Editor command: ${command}`);
          switch (command) {
            case 'view': {
              return editorContent;
            }
            case 'create': {
              editorContent = new_str!;
              return editorContent;
            }
            case 'insert': {
              editorContent = insert_text!;
              return editorContent;
            }
            case 'str_replace': {
              editorContent = editorContent.replace(old_str!, new_str!);
              return editorContent;
            }
            default:
              return '';
          }
        },
      }),
    },
    prompt: 'Update my README file to talk about AI.',
    stopWhen: isStepCount(5),
  });

  console.log('Response:', result.text);
  console.log();
  console.log('Final editor content:', editorContent);
  console.log();
  console.log('Finish reason:', result.finishReason);
  console.log('Usage:', result.usage);
});
