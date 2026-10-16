import { createBedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { streamText } from 'ai';
import { run } from '../../lib/run';
import { z } from 'zod';

const bedrockAnthropic = createBedrockAnthropic({
  headers: {
    'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
  },
});

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
  },
} as const;

run(async () => {
  console.log('=== Fine-grained tool streaming test (Bedrock Anthropic) ===\n');

  const result = streamText({
    model: bedrockAnthropic('global.anthropic.claude-sonnet-4-6'),

    messages: [
      {
        role: 'user',
        content: 'Write a bubble sort implementation in JavaScript to sort.js',
      },
    ],

    tools,
    toolChoice: 'required',
    providerOptions: {
      // alternatively this feature can be enabled with:
      // anthropic: {
      //   anthropicBeta: ['fine-grained-tool-streaming-2025-05-14'],
      // },
    },
  });

  let sawToolInputStart = false;
  let toolInputDeltaCount = 0;
  let sawToolInputEnd = false;
  const toolInputDeltaTimestamps: number[] = [];

  // ts() prints a compact timestamp to stderr so we can see real-time ordering
  const T0 = Date.now();
  const ts = (label: string) =>
    process.stderr.write(
      `+${((Date.now() - T0) / 1000).toFixed(2)}s ${label}\n`,
    );

  ts('stream started');

  for await (const part of result.stream) {
    switch (part.type) {
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
        toolInputDeltaTimestamps.push(Date.now());
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
  // Count consecutive delta intervals >= 5ms (genuine per-token generation time).
  // A buffered dump replays all deltas synchronously (<1ms each); real streaming
  // has most intervals >= 5ms as each token takes time to generate.
  // Threshold is heuristic — the desired behavior is smooth continuous streaming
  // instead of a long hang followed by a dump of all chunks at once.
  let liveIntervals = 0;
  for (let i = 1; i < toolInputDeltaTimestamps.length; i++) {
    if (toolInputDeltaTimestamps[i] - toolInputDeltaTimestamps[i - 1] >= 5)
      liveIntervals++;
  }
  const liveRatio =
    toolInputDeltaTimestamps.length > 1
      ? liveIntervals / (toolInputDeltaTimestamps.length - 1)
      : 0;
  const isStreaming = toolInputDeltaCount >= 5 && liveRatio > 0.5;

  console.log('\n=== Summary ===');
  console.log('tool-input-start received :', sawToolInputStart);
  console.log('tool-input-delta count    :', toolInputDeltaCount);
  console.log('tool-input-end received   :', sawToolInputEnd);
  console.log(
    `Fine-grained tool streaming: ${isStreaming ? 'YES' : 'NO'} (${toolInputDeltaCount} deltas, ${(liveRatio * 100).toFixed(0)}% live intervals)`,
  );
});
