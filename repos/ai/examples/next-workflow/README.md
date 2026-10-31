# AI SDK - WorkflowAgent Chat Example

This example demonstrates using the AI SDK's `WorkflowAgent` with the Workflow DevKit to build a durable, resumable chat agent with tool calling.

## Features

- **Durable Agent**: Uses `WorkflowAgent` from `@ai-sdk/workflow` for fault-tolerant AI agent execution
- **Tool Calling**: Includes weather lookup and calculator tools implemented as durable steps
- **`toModelOutput`**: The `getWeather` tool sends the model a compact one-line summary while the UI keeps the full structured result
- **Streaming**: Real-time streaming responses via `getWritable()` and `createUIMessageStreamResponse`
- **Resumable**: Workflow runs survive restarts and can be reconnected
- **Telemetry E2E Harness**: Visit `/telemetry` to run deterministic WorkflowAgent telemetry scenarios for lifecycle events, tool execution, context filtering, approvals, errors, and reconnects
- **Sandbox E2E Harness**: Visit `/sandbox` to run a deterministic WorkflowAgent sandbox tool execution scenario

## Testing `toModelOutput`

`WorkflowAgent` honors a tool's optional `toModelOutput` hook, just like `generateText`, `streamText`, and `ToolLoopAgent`. The hook controls what the model sees for a tool result, independent of what the app/UI receives.

The `getWeather` tool in `workflow/agent-chat.ts` demonstrates this:

1. Run the app and ask: **"What's the weather in Boston?"**
2. In the browser, the rendered tool result shows the full JSON object (`{ city, temperature, unit, condition }`) from the raw `execute` return.
3. In the dev server terminal, the `onEnd` callback logs the model-facing tool result, for example:

   ```json
   {
     "type": "tool-result",
     "toolName": "getWeather",
     "output": { "type": "text", "value": "Boston: 22°C, sunny." }
   }
   ```

The `calculate` tool has no `toModelOutput`, so its model-facing output stays the default `json` serialization for comparison.

## Running

1. Install dependencies: `pnpm install`
2. Start the dev server: `pnpm dev`
3. Open http://localhost:3000

## Telemetry

Open http://localhost:3000/telemetry to run deterministic WorkflowAgent telemetry scenarios. The harness records stable AI SDK telemetry integration events for lifecycle callbacks, model calls, chunks, tool execution, context filtering, approval resume, error handling, and reconnect behavior.

## Sandbox

Open http://localhost:3000/sandbox to run a deterministic WorkflowAgent `experimental_sandbox` scenario. The harness verifies that the sandbox session provided to `agent.stream` is available during tool execution.
