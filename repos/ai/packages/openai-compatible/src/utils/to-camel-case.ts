import type { SharedV4Warning } from '@ai-sdk/provider';

export function toCamelCase(str: string): string {
  return str.replace(/[_-]([a-z])/g, g => g[1].toUpperCase());
}

/**
Resolves which key to use for providerMetadata based on what the caller
passed in providerOptions. Returns the camelCase variant when the caller
supplied it, otherwise falls back to the raw name.
*/
export function resolveProviderOptionsKey(
  rawName: string,
  providerOptions: Record<string, unknown> | undefined,
): string {
  const camelName = toCamelCase(rawName);
  if (camelName !== rawName && providerOptions?.[camelName] != null) {
    return camelName;
  }
  return rawName;
}

/**
Pushes a deprecation warning when the user supplies providerOptions under a non-camelCase key
*/
export function warnIfDeprecatedProviderOptionsKey({
  rawName,
  providerOptions,
  warnings,
}: {
  rawName: string;
  providerOptions: Record<string, unknown> | undefined;
  warnings: SharedV4Warning[];
}): void {
  const camelName = toCamelCase(rawName);
  if (camelName !== rawName && providerOptions?.[rawName] != null) {
    warnings.push({
      type: 'deprecated',
      setting: `providerOptions key '${rawName}'`,
      message: `Use '${camelName}' instead.`,
    });
  }
}
