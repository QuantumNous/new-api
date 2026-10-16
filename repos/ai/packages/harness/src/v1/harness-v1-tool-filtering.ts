export type HarnessV1BuiltinToolFiltering =
  | {
      mode: 'allow';
      toolNames: string[];
    }
  | {
      mode: 'deny';
      toolNames: string[];
    };

export function isHarnessV1BuiltinToolIncluded(input: {
  toolName: string;
  toolFiltering: HarnessV1BuiltinToolFiltering | undefined;
}): boolean {
  if (input.toolFiltering == null) return true;
  return input.toolFiltering.mode === 'allow'
    ? input.toolFiltering.toolNames.includes(input.toolName)
    : !input.toolFiltering.toolNames.includes(input.toolName);
}

export function getHarnessV1BuiltinToolFilteringDenialReason(input: {
  toolName: string;
}): string {
  return `Tool '${input.toolName}' is inactive due to the HarnessAgent tool filtering policy.`;
}
