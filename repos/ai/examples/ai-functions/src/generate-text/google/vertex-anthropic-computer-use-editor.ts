import { run } from '../../lib/run';
import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { generateText, isStepCount } from 'ai';

run(async () => {
  let editorContent = `
## README
This is a test file.
  `;

  const result = await generateText({
    model: vertexAnthropic('claude-3-5-sonnet-v2@20241022'),
    tools: {
      str_replace_editor: vertexAnthropic.tools.textEditor_20241022({
        async execute({ command, path, old_str, new_str, insert_text }) {
          console.log({ command, path, old_str, new_str, insert_text });
          switch (command) {
            case 'view': {
              return editorContent;
            }
            case 'create': {
              editorContent = new_str!;
              return editorContent;
            }
            case 'str_replace': {
              editorContent = editorContent.replace(old_str!, new_str!);
              return editorContent;
            }
            case 'insert': {
              editorContent = insert_text!;
              return editorContent;
            }
          }
        },
      }),
    },
    prompt: 'Update my README file to talk about AI.',
    stopWhen: isStepCount(5),
  });

  console.log('TEXT', result.text);
  console.log();
  console.log('EDITOR CONTENT', editorContent);
});
