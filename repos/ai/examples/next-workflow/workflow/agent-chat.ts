import { anthropic } from '@ai-sdk/anthropic';
import { WorkflowAgent, type ModelCallStreamPart } from '@ai-sdk/workflow';
import {
  convertToModelMessages,
  type UIMessage,
  type ToolCallRepairFunction,
} from 'ai';
import { getWritable } from 'workflow';
import { z } from 'zod';

// ============================================================================
// Tool step functions
// ============================================================================

async function getWeather(
  input: { city: string },
  options: { context: { defaultUnit: 'celsius' | 'fahrenheit' } },
): Promise<{
  city: string;
  temperature: number;
  unit: 'celsius' | 'fahrenheit';
  condition: string;
}> {
  'use step';
  const hash = input.city
    .toLowerCase()
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const fahrenheit = 40 + (hash % 60);
  const conditions = [
    'sunny',
    'cloudy',
    'rainy',
    'snowy',
    'windy',
    'partly cloudy',
  ];
  const unit = options.context.defaultUnit;
  return {
    city: input.city,
    temperature:
      unit === 'celsius' ? Math.round(((fahrenheit - 32) * 5) / 9) : fahrenheit,
    unit,
    condition: conditions[hash % conditions.length],
  };
}

async function calculate(input: {
  expression: string;
}): Promise<{ expression: string; result: number }> {
  'use step';
  const translated = input.expression.replace(/\s/g, '').replace(/\^/g, '**');
  if (!/^[0-9+\-*/().]+$/.test(translated))
    throw new Error(`Invalid expression: ${input.expression}`);
  return {
    expression: input.expression,
    result: new Function(`return (${translated})`)() as number,
  };
}

async function deleteFileStep(
  input: { path: string },
  options: { context: { rootDir: string } },
): Promise<{ deleted: string }> {
  'use step';
  // Sandbox file deletion to the per-request root directory passed through
  // `toolsContext.deleteFile.rootDir`. Without this, the tool would happily
  // delete anything the model asked for.
  if (!input.path.startsWith(options.context.rootDir)) {
    throw new Error(
      `[deleteFile] Refusing to delete outside ${options.context.rootDir}: ${input.path}`,
    );
  }
  console.log('[deleteFile] Deleting:', input.path);
  return { deleted: input.path };
}

// ============================================================================
// Tools and workflow
// ============================================================================

const tools = {
  getWeather: {
    description: 'Get the current weather for a city.',
    inputSchema: z.object({ city: z.string().describe('The city name') }),
    contextSchema: z.object({
      defaultUnit: z.enum(['celsius', 'fahrenheit']),
    }),
    execute: getWeather,

    // `toModelOutput` controls what the model sees for this tool result.
    // The app/UI still receives the full structured object, but the model
    // receives this compact one-line summary instead of raw JSON.
    toModelOutput: ({
      output,
    }: {
      output: Awaited<ReturnType<typeof getWeather>>;
    }) => ({
      type: 'text' as const,
      value: `${output.city}: ${output.temperature}°${
        output.unit === 'celsius' ? 'C' : 'F'
      }, ${output.condition}.`,
    }),
  },
  calculate: {
    description: 'Evaluate a math expression.',
    inputSchema: z.object({
      expression: z.string().describe('The expression'),
    }),
    execute: calculate,
  },
  deleteFile: {
    description: 'Delete a file from the filesystem.',
    inputSchema: z.object({ path: z.string().describe('The file path') }),
    contextSchema: z.object({
      rootDir: z.string().describe('Directory the deletion is sandboxed to'),
    }),
    execute: deleteFileStep,
    needsApproval: true as const,
  },
};

const repairToolCall: ToolCallRepairFunction<typeof tools> = async ({
  toolCall,
}) => {
  'use step';
  return toolCall;
};

/**
 * Per-request context the route handler resolves and passes into the
 * workflow. Demonstrates the two complementary context APIs:
 *
 * - `runtimeContext` — shared agent state that flows through `prepareStep`,
 *   lifecycle callbacks, and `onEnd`. Not added to the prompt.
 * - `toolsContext` — per-tool, schema-validated state. Each tool's
 *   `execute` only sees its own validated entry as `context`.
 */
export interface ChatRequestContext {
  tenantId: string;
  requestId: string;
  userPlan: 'free' | 'enterprise';
  preferredUnit: 'celsius' | 'fahrenheit';
  fileRootDir: string;
}

export async function chat(messages: UIMessage[], request: ChatRequestContext) {
  'use workflow';

  // Pass `tools` so prior tool results from the UI history are reconstructed
  // through each tool's `toModelOutput` hook — the same conversion WorkflowAgent
  // applies to fresh tool results. Without this, earlier-turn tool results would
  // fall back to default `json`/`text` serialization, diverging across turns.
  const modelMessages = await convertToModelMessages(messages, { tools });

  const agent = new WorkflowAgent({
    model: anthropic('claude-sonnet-4-20250514'),
    instructions:
      'You are a helpful assistant with access to weather, calculator, and file deletion tools. Always use the appropriate tool when the user asks to perform an action — never just say you will do it, actually call the tool. Keep responses concise.',
    tools,

    // Shared agent state. Available in `prepareStep`, lifecycle callbacks,
    // and `onEnd`. Treat as immutable — return a new value from
    // `prepareStep` to update it between steps.
    runtimeContext: {
      tenantId: request.tenantId,
      requestId: request.requestId,
      plan: request.userPlan,
    },

    // Per-tool context, validated against each tool's `contextSchema`.
    // Each tool's `execute` receives only its own entry as `context`;
    // sensitive values like `rootDir` never leak across tools.
    toolsContext: {
      getWeather: { defaultUnit: request.preferredUnit },
      deleteFile: { rootDir: request.fileRootDir },
    },

    // `prepareStep` can read `runtimeContext` and tweak settings per-step.
    // Enterprise plans get more deterministic answers.
    prepareStep: ({ runtimeContext }) => {
      if (runtimeContext.plan === 'enterprise') {
        return { temperature: 0.2 };
      }
      return {};
    },

    // Make `toModelOutput` observable end-to-end. The tool-role messages here
    // carry the model-facing tool results, while the UI renders raw tool output.
    onEnd: ({ messages }) => {
      const modelFacingToolResults = messages
        .filter(message => message.role === 'tool')
        .flatMap(message =>
          Array.isArray(message.content) ? message.content : [],
        );
      console.log(
        '[WorkflowAgent] model-facing tool results (post toModelOutput):',
        JSON.stringify(modelFacingToolResults, null, 2),
      );
    },
  });

  const result = await agent.stream({
    messages: modelMessages,
    writable: getWritable<ModelCallStreamPart>(),
    repairToolCall: repairToolCall as any,
  });

  return { messages: result.messages };
}
