import type {
  Experimental_SandboxSession,
  Experimental_SandboxProcess,
} from '@ai-sdk/provider-utils';

/**
 * No-op stubs for the file and spawn methods on `Experimental_SandboxSession`,
 * intended to be spread into test fixtures that only care about `run`.
 */
export const mockSandboxSessionFileStubs: Pick<
  Experimental_SandboxSession,
  | 'readFile'
  | 'readBinaryFile'
  | 'readTextFile'
  | 'writeFile'
  | 'writeBinaryFile'
  | 'writeTextFile'
  | 'spawn'
> = {
  readFile: async () => null,
  readBinaryFile: async () => null,
  readTextFile: async () => null,
  writeFile: async () => {},
  writeBinaryFile: async () => {},
  writeTextFile: async () => {},
  spawn: async (): Promise<Experimental_SandboxProcess> => ({
    stdout: new ReadableStream<Uint8Array>({ start: c => c.close() }),
    stderr: new ReadableStream<Uint8Array>({ start: c => c.close() }),
    wait: async () => ({ exitCode: 0 }),
    kill: async () => {},
  }),
};
