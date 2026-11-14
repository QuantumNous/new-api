import { tool, type ProviderDefinedTool, type Tool } from './types/tool';
import type { FlexibleSchema } from './schema';
import type { Context } from './types/context';
import type { ToolExecuteFunction } from './types/tool-execute-function';
/**
 * A provider-defined tool is a tool for which the provider defines the input
 * and output schemas, but does not execute the tool.
 */
export type ProviderDefinedToolFactory<
  INPUT,
  ARGS extends object,
  CONTEXT extends Context = {},
> = <OUTPUT>(
  options: ARGS & {
    execute?: ToolExecuteFunction<INPUT, OUTPUT, CONTEXT>;
    needsApproval?: Tool<INPUT, OUTPUT, CONTEXT>['needsApproval'];
    toModelOutput?: Tool<INPUT, OUTPUT, CONTEXT>['toModelOutput'];
    onInputStart?: Tool<INPUT, OUTPUT, CONTEXT>['onInputStart'];
    onInputDelta?: Tool<INPUT, OUTPUT, CONTEXT>['onInputDelta'];
    onInputAvailable?: Tool<INPUT, OUTPUT, CONTEXT>['onInputAvailable'];
  },
) => ProviderDefinedTool<INPUT, OUTPUT, CONTEXT>;

export function createProviderDefinedToolFactory<
  INPUT,
  ARGS extends object,
  CONTEXT extends Context = {},
>({
  id,
  inputSchema,
}: {
  id: `${string}.${string}`;
  inputSchema: FlexibleSchema<INPUT>;
}): ProviderDefinedToolFactory<INPUT, ARGS, CONTEXT> {
  return <OUTPUT>({
    execute,
    outputSchema,
    needsApproval,
    toModelOutput,
    onInputStart,
    onInputDelta,
    onInputAvailable,
    ...args
  }: ARGS & {
    execute?: ToolExecuteFunction<INPUT, OUTPUT, CONTEXT>;
    outputSchema?: FlexibleSchema<OUTPUT>;
    needsApproval?: Tool<INPUT, OUTPUT, CONTEXT>['needsApproval'];
    toModelOutput?: Tool<INPUT, OUTPUT, CONTEXT>['toModelOutput'];
    onInputStart?: Tool<INPUT, OUTPUT, CONTEXT>['onInputStart'];
    onInputDelta?: Tool<INPUT, OUTPUT, CONTEXT>['onInputDelta'];
    onInputAvailable?: Tool<INPUT, OUTPUT, CONTEXT>['onInputAvailable'];
  }): ProviderDefinedTool<INPUT, OUTPUT, CONTEXT> =>
    tool({
      type: 'provider',
      isProviderExecuted: false,
      id,
      args,
      inputSchema,
      outputSchema,
      execute,
      needsApproval,
      toModelOutput,
      onInputStart,
      onInputDelta,
      onInputAvailable,
    }) as ProviderDefinedTool<INPUT, OUTPUT, CONTEXT>;
}

export type ProviderDefinedToolFactoryWithOutputSchema<
  INPUT,
  OUTPUT,
  ARGS extends object,
  CONTEXT extends Context = {},
> = (
  options: ARGS & {
    execute?: ToolExecuteFunction<INPUT, OUTPUT, CONTEXT>;
    needsApproval?: Tool<INPUT, OUTPUT, CONTEXT>['needsApproval'];
    toModelOutput?: Tool<INPUT, OUTPUT, CONTEXT>['toModelOutput'];
    onInputStart?: Tool<INPUT, OUTPUT, CONTEXT>['onInputStart'];
    onInputDelta?: Tool<INPUT, OUTPUT, CONTEXT>['onInputDelta'];
    onInputAvailable?: Tool<INPUT, OUTPUT, CONTEXT>['onInputAvailable'];
  },
) => ProviderDefinedTool<INPUT, OUTPUT, CONTEXT>;

export function createProviderDefinedToolFactoryWithOutputSchema<
  INPUT,
  OUTPUT,
  ARGS extends object,
  CONTEXT extends Context = {},
>({
  id,
  inputSchema,
  outputSchema,
}: {
  id: `${string}.${string}`;
  inputSchema: FlexibleSchema<INPUT>;
  outputSchema: FlexibleSchema<OUTPUT>;
}): ProviderDefinedToolFactoryWithOutputSchema<INPUT, OUTPUT, ARGS, CONTEXT> {
  return ({
    execute,
    needsApproval,
    toModelOutput,
    onInputStart,
    onInputDelta,
    onInputAvailable,
    ...args
  }: ARGS & {
    execute?: ToolExecuteFunction<INPUT, OUTPUT, CONTEXT>;
    needsApproval?: Tool<INPUT, OUTPUT, CONTEXT>['needsApproval'];
    toModelOutput?: Tool<INPUT, OUTPUT, CONTEXT>['toModelOutput'];
    onInputStart?: Tool<INPUT, OUTPUT, CONTEXT>['onInputStart'];
    onInputDelta?: Tool<INPUT, OUTPUT, CONTEXT>['onInputDelta'];
    onInputAvailable?: Tool<INPUT, OUTPUT, CONTEXT>['onInputAvailable'];
  }): ProviderDefinedTool<INPUT, OUTPUT, CONTEXT> =>
    tool({
      type: 'provider',
      isProviderExecuted: false,
      id,
      args,
      inputSchema,
      outputSchema,
      execute,
      needsApproval,
      toModelOutput,
      onInputStart,
      onInputDelta,
      onInputAvailable,
    }) as ProviderDefinedTool<INPUT, OUTPUT, CONTEXT>;
}
