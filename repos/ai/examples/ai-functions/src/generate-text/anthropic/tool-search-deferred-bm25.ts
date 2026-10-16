import { anthropic } from '@ai-sdk/anthropic';
import { generateText, tool, isStepCount } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  let stepNumber = 0;

  const result = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    prompt: `You have access to a note-taking system. Please:
            1. First read the note tree to see the current structure
            2. Then add "bye" as a new bullet after "hi"

            The noteId is "d10aa585-982b-4bd9-984e-420f9b3717f7".
            Remember, you may need to search for the right tools to perform editor operations.`,
    stopWhen: isStepCount(20),
    onStepFinish: step => {
      stepNumber++;
      console.log(`\n========== STEP ${stepNumber} ==========`);
      console.log('Response body (JSON):');
      console.log(JSON.stringify(step.response.body, null, 2));
      console.log(
        '\nTool calls:',
        step.toolCalls.map(tc => tc.toolName),
      );
      console.log(
        'Tool results:',
        step.toolResults.map(tr => tr.toolName),
      );
      console.log(`========== END STEP ${stepNumber} ==========\n`);
    },
    tools: {
      toolSearch: anthropic.tools.toolSearchBm25_20251119(),

      readNoteTree: tool({
        description:
          'Read the note tree structure to see all notes and their content',
        inputSchema: z.object({
          noteId: z.string().describe('The note ID to read'),
        }),
        execute: async ({ noteId }) => ({
          noteId,
          content: [{ type: 'bulletedListItem', text: 'hi' }],
        }),
      }),

      executeEditorOperation: tool({
        description:
          'Execute operations on the editor like inserting blocks, text, etc.',
        inputSchema: z.object({
          noteId: z.string().describe('The note ID'),
          operations: z.array(
            z.object({
              op: z.string(),
              at: z
                .object({
                  type: z.string(),
                  path: z.array(z.number()),
                })
                .optional(),
              type: z.string().optional(),
              text: z.string().optional(),
            }),
          ),
        }),
        execute: async ({ noteId, operations }) => ({
          success: true,
          noteId,
          appliedOperations: operations.length,
        }),
        providerOptions: {
          anthropic: { deferLoading: true },
        },
      }),
    },
  });

  console.log('\n=== FINAL RESULT ===');
  console.log('Text:', result.text);
});
