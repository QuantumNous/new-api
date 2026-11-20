import { expectTypeOf, test } from 'vitest';
import type { HarnessV1NetworkSandboxSession } from './harness-v1-network-sandbox-session';
import type { HarnessV1SandboxProvider } from './harness-v1-sandbox-provider';

test('HarnessV1SandboxProvider has createSession returning a network sandbox session', () => {
  type CreateReturn = ReturnType<HarnessV1SandboxProvider['createSession']>;
  expectTypeOf<
    Awaited<CreateReturn>
  >().toEqualTypeOf<HarnessV1NetworkSandboxSession>();
});
