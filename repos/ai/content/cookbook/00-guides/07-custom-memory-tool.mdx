---
title: Build a Custom Memory Tool
description: Build an agent that persists memories using a filesystem-backed memory tool.
---

# Build a Custom Memory Tool

Memory means saving the right information at the right time, in the right place, and injecting it back into the conversation when it matters. Without memory, your agent treats every conversation as its first. With memory, your agent builds context over time, recalls previous interactions, and adapts to the user.

## The Storage Primitive: The Filesystem

Where should you store memories? Files organized in a filesystem-like structure are a natural fit:

- **Persistence**: you can persist files across process restarts and conversations
- **Speed**: reading and writing files is fast, even at scale
- **Familiarity**: language models understand files and paths from their training data
- **Hierarchy**: you can use a directory structure to create deep and organized memory banks, grouping memories by topic, time, or type

The key insight is that "filesystem" here is an abstraction. The backing store does not matter. You could use a real sandboxed filesystem, an in-memory virtual filesystem, or a shim over Postgres. What matters is the concept: files organized in a hierarchical structure, and an interface that can manipulate, search, read, and edit those files. That is the primitive.

## The Interface: A Memory Tool

You have files. Now the model needs to interact with them. You give the model a tool, along with instructions for when and how to use it. There are two approaches:

### Structured Actions Tool

Define explicit actions the model can take (`view`, `create`, `update`, `search`) and have the model generate structured input that you handle yourself:

```json
{
  "name": "memory",
  "input": {
    "command": "view",
    "path": "/memories/customer_service_guidelines.xml"
  }
}
```

This is safe by design since you control every operation that runs. However, it requires more upfront implementation and limits the model to only the actions you have built.

### Bash-Backed Tool

The alternative is to back the memory tool with bash. Models are proficient at composing shell commands, which lets them craft flexible queries to access what they need: `cat` a file, `grep` for patterns, pipe commands together, or perform in-place edits with `sed`. This is the more powerful approach, but it requires careful work to build an approval system that prevents prompt injection and blocks dangerous commands.

## Types of Memory

Not all memories are equal. They differ in how you store them, how often the model accesses them, and when they surface:

- **Core Memory**: information included in every turn. This can range from the user's name to instructions for where to find other memories. You inject core memory directly into the system prompt, so the model always has it without needing a tool call.
- **Archival Memory**: a notes folder or file where the model stores detailed knowledge. Think of it as the model's notebook, where it writes down facts, summaries, and observations for later. The model reads and writes archival memory on demand through the memory tool.
- **Recall Memory**: the conversations themselves. By persisting full turn-by-turn history, the model can search previous interactions to surface relevant context from past discussions.

These memory terms are based on [Letta's definitions](https://www.letta.com/blog/agent-memory).

## What We Will Build

This recipe is a simplified demonstration of these concepts. You build one memory tool over a shared `.memory` store, then wire it into an agent with `prepareCall` so core memory is injected before each model call. You can implement the tool with structured actions or with a bash-backed interface.

The memory layout is a `.memory` directory with three files, each mapping to one of the memory types above:

```
.memory/
├── core.md               # Core memory, injected every turn
├── notes.md              # Archival memory, timestamped notes
└── conversations.jsonl   # Recall memory, full turn history (JSONL)
```

## Prerequisites

To follow this guide, you need the following:

1. **AI SDK** with `ToolLoopAgent` and `tool`
2. **Zod** for tool input schemas
3. **Optional for Route B (bash-backed)**: **[just-bash](https://github.com/vercel-labs/just-bash)** for command execution and AST parsing

Install dependencies for both routes:

```bash
pnpm add ai just-bash zod
```

If you only use Route A (structured actions), you can skip `just-bash`.

## Implementation Requirements

Before building the agent, you need shared infrastructure plus one route-specific piece:

1. **Bootstrap the filesystem.** On startup, ensure the memory directory and its files exist with reasonable defaults. This is a one-time setup step: create the directory if missing, seed each file with starter content if it does not already exist, and add the memory directory to `.gitignore` to keep it local and private.

2. **Helper functions for core memory and conversation logging.** You need a way to read core memory (so you can inject it into the system prompt) and a way to append conversation entries. Conversations are stored as JSONL (one JSON object per line), which makes them straightforward to `grep` for keywords and pipe through `jq` for formatting.

3. **Route-specific execution safety.**
   - **Route A (structured actions):** keep the action set small and explicit (`view`, `create`, `update`, `search`) and only operate on known `.memory` paths.
   - **Route B (bash-backed):** validate commands before execution. Users can craft prompts that try to run harmful commands, so use AST-based validation and an allowlist. See the [Appendix](#appendix-command-guard) for a full implementation with `just-bash`.

## Step 1: Define the Memory Tool

Choose your tool interface first. Both routes use the same `.memory` files, the same `prepareCall` injection pattern, and the same conversation logging. The only difference is how the model issues memory operations.

### Route A: Structured Actions Tool

Use this when you want predictable, explicit operations (`view`, `create`, `update`, `search`) and minimal command-safety surface.

Define a schema and route every request through your own `runMemoryCommand` handler:

```ts
import { tool } from 'ai';
import { z } from 'zod';

const memoryInputSchema = z.object({
  command: z
    .enum(['view', 'create', 'update', 'search'])
    .describe(
      'Memory action: view to read, create to write new content, update to change existing content, search to find relevant lines.',
    ),
  path: z
    .string()
    .optional()
    .describe(
      'Memory path under /memories, such as /memories/core.md or /memories/notes.md. Required for view, create, and update.',
    ),
  content: z
    .string()
    .optional()
    .describe('Text to write for create or update commands.'),
  mode: z
    .enum(['append', 'overwrite'])
    .optional()
    .describe(
      'Write mode for update: append adds to existing content, overwrite replaces it. Defaults to overwrite.',
    ),
  query: z
    .string()
    .optional()
    .describe(
      'Search keywords for the search command. Prefer short focused terms.',
    ),
});

const memoryTool = tool({
  description: `Use this tool to read and maintain long-term memory under /memories.

Rules:
- If the user prompt might depend on preferences, history, constraints, or goals, search first, then reply.
- If the prompt is fully self-contained or general knowledge, reply directly.
- Keep searches short and focused (1-4 words).
- Store durable user facts in /memories/core.md and detailed notes in /memories/notes.md.
- Keep memory operations invisible in user-facing replies.`,
  inputSchema: memoryInputSchema,
  execute: async input => {
    try {
      const output = await runMemoryCommand(input);
      return { output };
    } catch (error) {
      return { output: `Memory action failed: ${(error as Error).message}` };
    }
  },
});
```

This keeps memory operations predictable because the model can only call predefined actions.

### Route B: Bash-Backed Tool

Use this when you want maximum flexibility in reads, writes, and ad-hoc search.

```ts
import { tool } from 'ai';
import { Bash, ReadWriteFs } from 'just-bash';
import { z } from 'zod';

const fs = new ReadWriteFs({ root: process.cwd() });
const bash = new Bash({ fs, cwd: '/' });

const memoryTool = tool({
  description: `Run bash commands only for memory-related tasks.

This tool is restricted to memory workflows. Do not use it for
general project work, code changes, dependency management, or
system administration.

Inside the tool, use paths under /.memory:
- /.memory/core.md for key facts that should be reused later
- /.memory/notes.md for detailed notes
- /.memory/conversations.jsonl for full turn history

Rules:
- Only perform memory-related reads/writes and conversation recall
- Keep /.memory/core.md short and focused
- Prefer append-friendly notes in /.memory/notes.md for details
- If the user asks about prior conversations, search
  /.memory/conversations.jsonl for relevant keywords first
- Use >> to append, > to overwrite, and perl -pi -e for in-place edits

Examples:
- cat /.memory/core.md
- echo "- User prefers concise answers" >> /.memory/core.md
- perl -pi -e 's/concise answers/detailed answers/g' /.memory/core.md
- grep -n "project" /.memory/notes.md
- echo "2026-02-16: started a Rust CLI" >> /.memory/notes.md
- grep -niE "pricing|budget" /.memory/conversations.jsonl
- tail -n 40 /.memory/conversations.jsonl | jq -c '.role + ": " + .content'`,
  inputSchema: z.object({
    command: z.string().describe('The bash command to execute.'),
  }),
  execute: async ({ command }) => {
    const unapprovedCommand = findUnapprovedCommand(command);
    if (unapprovedCommand) {
      return {
        stdout: '',
        stderr: `Blocked unapproved command: ${unapprovedCommand}\n`,
        exitCode: 1,
      };
    }

    const result = await bash.exec(command);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  },
});
```

`ReadWriteFs` reads and writes directly to the real filesystem, rooted at `process.cwd()`. Paths inside the bash interpreter map directly to disk: `/.memory/core.md` resolves to `<project-root>/.memory/core.md`.

The safety pipeline has two layers: the AST-based command guard rejects unapproved commands before they reach the interpreter, and `just-bash` itself is a JavaScript-based bash implementation (it does not spawn a real shell process). While the bash interpreter runs in JavaScript, the filesystem is real and commands read and write actual files on disk. This is why the command guard is critical.

The rest of this recipe (agent wiring, `prepareCall`, and run loop) works for either route.

## Step 2: Create the Agent

Wire everything together with `ToolLoopAgent`. The `prepareCall` hook reads core memory fresh before every LLM call and injects it into the system prompt:

```ts
import { ToolLoopAgent } from 'ai';

const today = new Date().toISOString().slice(0, 10);

const memoryAgent = new ToolLoopAgent({
  model: 'anthropic/claude-haiku-4.5',
  tools: { memory: memoryTool },
  prepareCall: async settings => {
    // user-defined function fetches the contents of /.memory/core.md on every turn
    const coreMemory = await readCoreMemory();
    return {
      ...settings,
      instructions: `Today's date is ${today}.

Core memory:
${coreMemory}

You can save and recall important information using the memory tool.`,
    };
  },
});
```

Because `prepareCall` runs before each generate call in the tool loop, the system prompt always reflects the latest state of `core.md`. If the model updates core memory during a conversation, the next loop iteration sees the change immediately.

## Step 3: Run the Agent

Bootstrap the filesystem, record conversations, and run the agent:

```ts
const prompt = 'Remember that my favorite editor is Neovim';

// Record the user message
await appendConversation({
  role: 'user',
  content: prompt,
  timestamp: new Date().toISOString(),
});

// Run the agent (loops automatically on tool calls)
const result = await memoryAgent.generate({ prompt });

// Record the assistant response
await appendConversation({
  role: 'assistant',
  content: result.text,
  timestamp: new Date().toISOString(),
});

console.log(result.text);
```

When the model decides it needs to store or recall information, it calls the `memory` tool. The `ToolLoopAgent` executes the tool and feeds the result back, continuing until the model produces a final text response.

A typical interaction looks like this:

1. User says "Remember that my favorite editor is Neovim"
2. The model calls `memory` with `echo "- Favorite editor: Neovim" >> /.memory/core.md`
3. The tool executes the command and returns the result
4. The model responds: "Got it, I've saved that your favorite editor is Neovim."
5. On the next run, `prepareCall` reads `core.md` and the fact appears in the system prompt

## Learn More

- [AI SDK documentation](https://ai-sdk.dev/docs) for `ToolLoopAgent`, `tool`, and `generateText`
- [just-bash](https://github.com/vercel-labs/just-bash) for the JavaScript-based bash interpreter and AST parser
- [AI SDK examples](https://github.com/vercel/ai/tree/main/examples) for more agent patterns

---

## Appendix: Implementation Details

The code below is the reference implementation for the infrastructure described in [Implementation Requirements](#implementation-requirements). It uses Node.js filesystem APIs and a Bun entrypoint, but you can port the patterns to any runtime.

### Appendix: Filesystem Bootstrap

Define the memory directory structure and bootstrap it on startup. Each file gets reasonable defaults if it does not already exist:

```ts
import {
  access,
  appendFile,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

const MEMORY_DIR = '.memory';
const MEMORY_ROOT = resolve(process.cwd(), MEMORY_DIR);
const CORE_MEMORY_PATH = join(MEMORY_ROOT, 'core.md');
const NOTES_PATH = join(MEMORY_ROOT, 'notes.md');
const CONVERSATIONS_PATH = join(MEMORY_ROOT, 'conversations.jsonl');

const DEFAULT_CORE_MEMORY = `# Core Memory
- Keep this short.
- Put stable user facts here.
`;

const DEFAULT_NOTES = `# Notes
Use this file for detailed memories and timestamped notes.
`;

async function ensureFile(path: string, content: string): Promise<void> {
  try {
    await access(path);
  } catch {
    await writeFile(path, content, 'utf8');
  }
}

async function ensureMemoryFilesystem(): Promise<void> {
  await mkdir(MEMORY_ROOT, { recursive: true });
  await ensureFile(CORE_MEMORY_PATH, DEFAULT_CORE_MEMORY);
  await ensureFile(NOTES_PATH, DEFAULT_NOTES);
  await ensureFile(CONVERSATIONS_PATH, '');
}
```

Add `.memory` to your `.gitignore` to keep memory local and private.

### Appendix: Helper Functions

One helper reads core memory for system prompt injection, the other appends conversation entries as JSONL:

```ts
async function readCoreMemory(): Promise<string> {
  try {
    return await readFile(CORE_MEMORY_PATH, 'utf8');
  } catch {
    return '';
  }
}

async function appendConversation(entry: {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}): Promise<void> {
  await appendFile(CONVERSATIONS_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
}
```

### Appendix: Structured Actions Handler

The `runMemoryCommand` function used in Route A maps each action to a filesystem operation. Paths are resolved relative to the memory root, and only known memory files are allowed:

```ts
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const MEMORY_FILES = ['core.md', 'notes.md', 'conversations.jsonl'];

function resolveMemoryPath(path: string): string {
  const relativePath = path
    .trim()
    .replace(/^\/?memories\/?/, '')
    .replace(/^\/?\.memory\/?/, '')
    .replace(/^\/+/, '');

  if (!MEMORY_FILES.includes(relativePath)) {
    throw new Error(`Unsupported memory path: ${path}`);
  }

  return join(MEMORY_ROOT, relativePath);
}

async function runMemoryCommand(input: {
  command: 'view' | 'create' | 'update' | 'search';
  path?: string;
  content?: string;
  mode?: 'append' | 'overwrite';
  query?: string;
}): Promise<string> {
  const { command, path, content, mode, query } = input;

  switch (command) {
    case 'view': {
      if (!path) throw new Error('path is required for view');
      return await readFile(resolveMemoryPath(path), 'utf8');
    }
    case 'create':
    case 'update': {
      if (!path) throw new Error('path is required');
      if (!content) throw new Error('content is required');
      const target = resolveMemoryPath(path);
      if (mode === 'append') {
        await appendFile(target, content, 'utf8');
      } else {
        await writeFile(target, content, 'utf8');
      }
      return `${command === 'create' ? 'Created' : 'Updated'} ${path}`;
    }
    case 'search': {
      if (!query) throw new Error('query is required for search');
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      const files = path
        ? [resolveMemoryPath(path)]
        : MEMORY_FILES.map(f => join(MEMORY_ROOT, f));
      const matches: string[] = [];

      for (const filePath of files) {
        const lines = (await readFile(filePath, 'utf8')).split('\n');
        for (const [i, line] of lines.entries()) {
          const lower = line.toLowerCase();
          if (terms.some(t => lower.includes(t))) {
            matches.push(`${relative(MEMORY_ROOT, filePath)}:${i + 1}:${line}`);
          }
        }
      }

      return matches.length > 0 ? matches.join('\n') : 'No matches found.';
    }
  }
}
```

### Appendix: Command Guard

The AST-based command guard walks every node in the parsed command (including pipelines, subshells, loops, and conditionals) and rejects anything not in the allowlist. This is more robust than string matching or regex. If a command name is dynamically constructed (e.g., via variable expansion), `extractLiteralWord` returns `null` and the guard skips the allowlist check for that command. Since `just-bash` is a JavaScript-based interpreter (not a real shell), dynamically constructed commands that bypass the allowlist check fail to resolve to real binaries. This is an acceptable tradeoff.

```ts
import {
  type CommandNode,
  parse,
  type ScriptNode,
  type WordNode,
} from 'just-bash';

const approvedCommands = new Set([
  'cat',
  'echo',
  'grep',
  'jq',
  'ls',
  'mkdir',
  'perl',
  'sed',
  'tail',
]);

function extractLiteralWord(word: WordNode | null): string | null {
  if (!word || word.parts.length !== 1) return null;
  const [part] = word.parts;
  if (!part || part.type !== 'Literal') return null;
  return part.value;
}

function collectCommandNames(script: ScriptNode): string[] {
  const names = new Set<string>();

  const visitCommand = (command: CommandNode): void => {
    switch (command.type) {
      case 'SimpleCommand': {
        const name = extractLiteralWord(command.name);
        if (name) names.add(name);
        break;
      }
      case 'If': {
        for (const clause of command.clauses) {
          for (const s of clause.condition) visitStatement(s);
          for (const s of clause.body) visitStatement(s);
        }
        if (command.elseBody) {
          for (const s of command.elseBody) visitStatement(s);
        }
        break;
      }
      case 'For':
      case 'CStyleFor':
      case 'While':
      case 'Until':
      case 'Subshell':
      case 'Group': {
        for (const s of command.body) visitStatement(s);
        break;
      }
      case 'Case': {
        for (const item of command.items) {
          for (const s of item.body) visitStatement(s);
        }
        break;
      }
      case 'FunctionDef': {
        visitCommand(command.body);
        break;
      }
      case 'ArithmeticCommand':
      case 'ConditionalCommand':
        break;
    }
  };

  const visitStatement = (
    statement: ScriptNode['statements'][number],
  ): void => {
    for (const pipeline of statement.pipelines) {
      for (const command of pipeline.commands) {
        visitCommand(command);
      }
    }
  };

  for (const statement of script.statements) {
    visitStatement(statement);
  }

  return [...names].sort();
}

export function findUnapprovedCommand(commandLine: string): string | null {
  let script: ScriptNode;
  try {
    script = parse(commandLine);
  } catch {
    return null;
  }
  const commandNames = collectCommandNames(script);
  return commandNames.find(name => !approvedCommands.has(name)) ?? null;
}
```
