import {
  NoSuchProviderReferenceError,
  type SharedV4ProviderReference,
} from '@ai-sdk/provider';
/**
 * Resolves a provider reference to the provider-specific identifier for the
 * given provider. Throws `NoSuchProviderReferenceError` if the provider is not
 * found in the reference mapping.
 */
export function resolveProviderReference({
  reference,
  provider,
}: {
  reference: SharedV4ProviderReference;
  provider: string;
}): string {
  const id = reference[provider];
  if (id != null) {
    return id;
  }

  throw new NoSuchProviderReferenceError({
    provider,
    reference,
  });
}
