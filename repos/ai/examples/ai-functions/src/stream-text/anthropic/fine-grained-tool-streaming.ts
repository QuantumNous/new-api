import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import 'dotenv/config';
import { z } from 'zod';

const anthropic = createAnthropic();

// fine grained tool streaming can be enabled with eager_input_streaming
// it is currently supported on custom tools only
// https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming

const tools = {
  write_to_file: {
    description:
      'Request to write content to a file. ALWAYS provide the COMPLETE file content, without any truncation.',
    inputSchema: z.object({
      path: z
        .string()
        .describe(
          'The path of the file to write to (relative to the current workspace directory)',
        ),
      content: z.string().describe('The content to write to the file.'),
    }),
    providerOptions: {
      anthropic: {
        eagerInputStreaming: true,
      },
    },
  },
} as const;

async function main() {
  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),

    messages: [
      {
        role: 'user',
        content: 'Write a bubble sort implementation in JavaScript to sort.js',
      },
    ],

    tools,
    toolChoice: 'required',
  });

  // ── stream events ─────────────────────────────────────────────────────────
  let sawToolInputStart = false;
  let toolInputDeltaCount = 0;
  let toolInputTotalBytes = 0;
  let sawToolInputEnd = false;
  let reasoningDeltaCount = 0;

  // ts() prints a compact timestamp to stderr so we can see real-time ordering
  const T0 = Date.now();
  const ts = (label: string) =>
    process.stderr.write(
      `+${((Date.now() - T0) / 1000).toFixed(2)}s ${label}\n`,
    );

  ts('stream started');

  for await (const part of result.stream) {
    switch (part.type) {
      case 'reasoning-start':
        ts('[reasoning-start]');
        process.stdout.write('\n[reasoning-start]\n');
        break;
      case 'reasoning-delta':
        reasoningDeltaCount++;
        if (reasoningDeltaCount === 1 || reasoningDeltaCount % 500 === 0) {
          ts(`[reasoning-delta #${reasoningDeltaCount}]`);
        }
        // process.stdout.write(part.text); // suppress to reduce noise
        break;
      case 'reasoning-end':
        ts(`[reasoning-end] total-reasoning-deltas=${reasoningDeltaCount}`);
        process.stdout.write('\n[reasoning-end]\n');
        break;
      case 'text-start':
        ts('[text-start]');
        process.stdout.write('\n[text-start]\n');
        break;
      case 'text-delta':
        process.stdout.write(part.text);
        break;
      case 'text-end':
        ts('[text-end]');
        process.stdout.write('\n[text-end]\n');
        break;
      case 'tool-input-start':
        sawToolInputStart = true;
        ts(`[tool-input-start] tool=${part.toolName}`);
        process.stdout.write(
          `\n[tool-input-start] id=${part.id} tool=${part.toolName}\n`,
        );
        break;
      case 'tool-input-delta':
        toolInputDeltaCount++;
        toolInputTotalBytes += part.delta.length;
        if (toolInputDeltaCount === 1 || toolInputDeltaCount % 100 === 0) {
          ts(`[tool-input-delta #${toolInputDeltaCount}]`);
        }
        process.stdout.write(part.delta);
        break;
      case 'tool-input-end':
        sawToolInputEnd = true;
        ts(`[tool-input-end]`);
        process.stdout.write(`\n[tool-input-end] id=${part.id}\n`);
        break;
      case 'tool-call': {
        const preview = JSON.stringify(part.input).slice(0, 80);
        ts(`[tool-call] tool=${part.toolName}`);
        console.log(
          `\n[tool-call] tool=${part.toolName} input(preview)=${preview}…`,
        );
        break;
      }
      case 'start-step':
        ts('[start-step]');
        console.log('\n[start-step]');
        break;
      case 'finish-step':
        ts(`[finish-step] reason=${part.finishReason}`);
        console.log(
          `[finish-step] finishReason=${part.finishReason} usage=${JSON.stringify(part.usage)}`,
        );
        break;
      case 'finish':
        ts(`[finish] reason=${part.finishReason}`);
        console.log(
          `\n[finish] finishReason=${part.finishReason} usage=${JSON.stringify(part.totalUsage)}`,
        );
        break;
      case 'error':
        ts('[error]');
        console.error('\n[error]', part.error);
        break;
    }
  }

  // ── diagnosis ─────────────────────────────────────────────────────────────
  // Eager input streaming streams fewer, larger chunks
  // Threshold is heuristic — tune based on observed output.
  const avgChunkBytes =
    toolInputDeltaCount > 0
      ? Math.round(toolInputTotalBytes / toolInputDeltaCount)
      : 0;
  const isEager = toolInputDeltaCount >= 1 && avgChunkBytes >= 12;

  console.log('\n=== Summary ===');
  console.log('tool-input-start received :', sawToolInputStart);
  console.log('tool-input-delta count    :', toolInputDeltaCount);
  console.log('tool-input-end received   :', sawToolInputEnd);
  console.log('reasoning-delta count     :', reasoningDeltaCount);
  console.log(
    `\nEager input streaming: ${isEager ? 'detected' : 'not detected'} (${toolInputDeltaCount} deltas, avg ${avgChunkBytes} bytes/chunk)`,
  );
}

main().catch(console.error);
