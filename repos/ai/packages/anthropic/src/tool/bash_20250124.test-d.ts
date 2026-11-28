import type {
  InferToolOutput,
  ProviderDefinedTool,
} from '@ai-sdk/provider-utils';
import { describe, expectTypeOf, it } from 'vitest';
import { bash_20250124 } from './bash_20250124';

type BashInput = {
  command: string;
  restart?: boolean;
};

type BashDefaultOutput = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

describe('bash_20250124 tool type', () => {
  it('uses the sandbox command result output by default', () => {
    const bashTool = bash_20250124();

    expectTypeOf(bashTool).toExtend<
      ProviderDefinedTool<BashInput, BashDefaultOutput, {}>
    >();
    expectTypeOf<
      InferToolOutput<typeof bashTool>
    >().toEqualTypeOf<BashDefaultOutput>();
  });

  it('allows disabling the default execute function', () => {
    const bashTool = bash_20250124({
      execute: null,
    });

    expectTypeOf(bashTool).toExtend<
      ProviderDefinedTool<BashInput, never, {}>
    >();
    expectTypeOf(bashTool.execute).toEqualTypeOf<undefined>();
  });

  it('infers custom execute output', () => {
    const bashTool = bash_20250124({
      execute: async (
        { command, restart },
        { experimental_sandbox: sandbox },
      ) => {
        expectTypeOf(command).toEqualTypeOf<string>();
        expectTypeOf(restart).toEqualTypeOf<boolean | undefined>();
        expectTypeOf(sandbox).not.toEqualTypeOf<undefined>();

        return {
          command,
          restarted: restart ?? false,
        };
      },
    });

    expectTypeOf<InferToolOutput<typeof bashTool>>().toEqualTypeOf<{
      command: string;
      restarted: boolean;
    }>();
  });
});
