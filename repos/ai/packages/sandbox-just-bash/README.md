# AI SDK - just-bash Sandbox

_This package is **experimental**._

`HarnessV1SandboxProvider` implementation for [`just-bash`](https://github.com/vercel-labs/just-bash), an in-process JavaScript bash environment with a virtual filesystem. File operations and spawned processes share the same in-memory state.

This provider does not expose ports, so it cannot be used with features that require actual network sandboxes. It is primarily useful for handing a local `Experimental_SandboxSession` to AI SDK tools that accept `experimental_sandbox`.

## Setup

```bash
npm i @ai-sdk/sandbox-just-bash
```

## Usage

The factory is synchronous. The returned provider is stable; the actual `just-bash` `Sandbox` is created on demand inside `provider.createSession()`.

```ts
import { createJustBashSandbox } from '@ai-sdk/sandbox-just-bash';

const justBashSandbox = createJustBashSandbox({ cwd: '/work' });

const networkSandboxSession = await justBashSandbox.createSession();
const sandboxSession = networkSandboxSession.restricted();

await sandboxSession.writeTextFile({ path: '/work/hello.txt', content: 'hi' });

const { stdout } = await sandboxSession.run({
  command: 'cat /work/hello.txt',
});
console.log(stdout); // "hi"
```

`networkSandboxSession.restricted()` is typed as `Experimental_SandboxSession` and is the surface to hand to user tools. The network sandbox session's `getPortUrl` throws (just-bash has no port story) and `setNetworkPolicy` is omitted (no local enforcement primitive).

To wrap an already-created `just-bash` `Sandbox` (e.g. with a custom `fs`), pass it via `sandbox`. Install `just-bash` directly if your application imports `Sandbox`, `OverlayFs`, or other `just-bash` exports:

```ts
import { createJustBashSandbox } from '@ai-sdk/sandbox-just-bash';
import { OverlayFs, Sandbox } from 'just-bash';

const overlay = new OverlayFs({ root: process.cwd() });
const sandbox = createJustBashSandbox({
  sandbox: await Sandbox.create({ fs: overlay, cwd: overlay.getMountPoint() }),
});
```
