---
title: Experimental_SandboxSession
description: API Reference for the Experimental_SandboxSession interface.
---

# `Experimental_SandboxSession`

The `Experimental_SandboxSession` interface describes an execution environment that
tools can use to run commands. Pass an experimental sandbox using the
`experimental_sandbox` option to `generateText`, `streamText`,
`ToolLoopAgent.generate`, `ToolLoopAgent.stream`, or agent UI stream helpers to
make it available to tool description functions and tool execution.

<Note type="warning">
  This API is experimental and can change in patch releases. Passing an
  experimental sandbox does not sandbox the tool itself. Tool code still runs in
  your application process unless the tool explicitly delegates work to the
  experimental sandbox.
</Note>

## Import

<Snippet
  text={`import type { Experimental_SandboxSession } from "ai"`}
  prompt={false}
/>

## Type Definition

```ts
type Experimental_SandboxSession = {
  readonly description: string;
  readonly run: (options: {
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
    abortSignal?: AbortSignal;
  }) => PromiseLike<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }>;
};
```

## Properties

<PropertiesTable
  content={[
    {
      name: 'description',
      type: 'string',
      description:
        'Description of the experimental sandbox environment. Include this in your prompt or instructions when the model needs to know details such as the root directory, exposed ports, public hostname, or other environment constraints. The AI SDK does not add it to the prompt automatically.',
    },
    {
      name: 'run',
      type: '(options: { command: string; workingDirectory?: string; env?: Record<string, string>; abortSignal?: AbortSignal }) => PromiseLike<{ exitCode: number; stdout: string; stderr: string }>',
      description:
        'Executes a command in the experimental sandbox and resolves with the command exit code, standard output, and standard error.',
      properties: [
        {
          type: 'options',
          parameters: [
            {
              name: 'command',
              type: 'string',
              description:
                'The command to execute in the experimental sandbox.',
            },
            {
              name: 'workingDirectory',
              type: 'string | undefined',
              description:
                'Optional working directory to execute the command in. If omitted, the experimental sandbox implementation uses its default working directory.',
            },
            {
              name: 'env',
              type: 'Record<string, string> | undefined',
              description:
                'Optional environment variables to set for the command. Merged with the experimental sandbox default environment, with these values taking precedence. Passing secrets here instead of inlining them into the command avoids leaking them in logs. Implementations that cannot set environment variables reject this option.',
            },
            {
              name: 'abortSignal',
              type: 'AbortSignal | undefined',
              description:
                'Optional abort signal that the experimental sandbox implementation can use to cancel the command.',
            },
          ],
        },
      ],
    },
  ]}
/>

## Example

```ts
const result = await generateText({
  model: __MODEL__,
  tools: { shell },
  experimental_sandbox,
  prompt: 'Run the test suite.',
});
```

Inside a tool, read the experimental sandbox from the second `execute` argument:

```ts
const shell = tool({
  inputSchema: z.object({
    command: z.string(),
    workingDirectory: z.string().optional(),
  }),
  execute: async (
    { command, workingDirectory },
    { abortSignal, experimental_sandbox },
  ) => {
    if (!experimental_sandbox) {
      throw new Error('Experimental sandbox is not available');
    }

    return experimental_sandbox.run({
      command,
      workingDirectory,
      abortSignal,
    });
  },
});
```

## See Also

- [Tool Calling: Experimental Sandbox](/docs/ai-sdk-core/tools-and-tool-calling#experimental-sandbox)
- [`generateText`](/docs/reference/ai-sdk-core/generate-text)
- [`streamText`](/docs/reference/ai-sdk-core/stream-text)
- [`ToolLoopAgent`](/docs/reference/ai-sdk-core/tool-loop-agent)
