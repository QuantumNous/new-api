import {
  createProviderDefinedToolFactory,
  lazySchema,
  type Experimental_SandboxSession as SandboxSession,
  type ProviderDefinedTool,
  type Tool,
  type ToolExecuteFunction,
  zodSchema,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

type Bash20250124Input = {
  /**
   * The bash command to run. Required unless the tool is being restarted.
   */
  command: string;

  /**
   * Specifying true will restart this tool. Otherwise, leave this unspecified.
   */
  restart?: boolean;
};

const bash_20250124InputSchema = lazySchema(() =>
  zodSchema(
    z.object({
      command: z.string(),
      restart: z.boolean().optional(),
    }),
  ),
);

export const bash_20250124_internal = createProviderDefinedToolFactory<
  Bash20250124Input,
  {}
>({
  id: 'anthropic.bash_20250124',
  inputSchema: bash_20250124InputSchema,
});

type Bash20250124Options<OUTPUT> = {
  execute?: ToolExecuteFunction<Bash20250124Input, OUTPUT, {}>;
  needsApproval?: Tool<Bash20250124Input, OUTPUT, {}>['needsApproval'];
  toModelOutput?: Tool<Bash20250124Input, OUTPUT, {}>['toModelOutput'];
  onInputStart?: Tool<Bash20250124Input, OUTPUT, {}>['onInputStart'];
  onInputDelta?: Tool<Bash20250124Input, OUTPUT, {}>['onInputDelta'];
  onInputAvailable?: Tool<Bash20250124Input, OUTPUT, {}>['onInputAvailable'];
};

type Bash20250124OptionsWithNullableExecute<OUTPUT> = Omit<
  Bash20250124Options<OUTPUT>,
  'execute'
> & {
  execute?: Bash20250124Options<OUTPUT>['execute'] | null;
};

type Bash20250124DefaultOutput = Awaited<ReturnType<SandboxSession['run']>>;

export function bash_20250124(
  options?: Omit<Bash20250124Options<Bash20250124DefaultOutput>, 'execute'> & {
    execute?: undefined;
  },
): ProviderDefinedTool<Bash20250124Input, Bash20250124DefaultOutput, {}>;
export function bash_20250124<OUTPUT = never>(
  options: Omit<Bash20250124Options<OUTPUT>, 'execute'> & {
    execute: null;
  },
): ProviderDefinedTool<Bash20250124Input, OUTPUT, {}>;
export function bash_20250124<OUTPUT>(
  options: Omit<Bash20250124Options<OUTPUT>, 'execute'> & {
    execute: Bash20250124Options<OUTPUT>['execute'];
  },
): ProviderDefinedTool<Bash20250124Input, OUTPUT, {}>;
export function bash_20250124<OUTPUT>(
  options: Bash20250124OptionsWithNullableExecute<OUTPUT> = {},
): ProviderDefinedTool<Bash20250124Input, OUTPUT, {}> {
  const { execute, ...rest } = options;

  if (execute === undefined) {
    return bash_20250124_internal({
      ...rest,
      execute: async (
        { command },
        { abortSignal, experimental_sandbox: sandbox },
      ) => {
        if (!sandbox) {
          throw new Error('Sandbox session is not available');
        }

        return await sandbox.run({
          command,
          abortSignal,
        });
      },
    } as Bash20250124Options<Bash20250124DefaultOutput>) as ReturnType<
      typeof bash_20250124_internal<OUTPUT>
    >;
  }

  return bash_20250124_internal({
    ...rest,
    ...(execute === null ? {} : { execute }),
  } as Bash20250124Options<OUTPUT>);
}
