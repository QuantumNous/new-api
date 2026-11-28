import type {
  SharedV4ProviderMetadata,
  SharedV4Warning,
} from '@ai-sdk/provider';
import type { AlibabaCacheControl } from './alibaba-chat-prompt';

// Alibaba allows a maximum of 4 cache breakpoints per request
const MAX_CACHE_BREAKPOINTS = 4;

function getCacheControl(
  providerMetadata: SharedV4ProviderMetadata | undefined,
): AlibabaCacheControl | undefined {
  const alibaba = providerMetadata?.alibaba;

  const cacheControlValue = alibaba?.cacheControl ?? alibaba?.cache_control;

  // Pass through value assuming it is of the correct type.
  // The Alibaba API will validate the value.
  return cacheControlValue as AlibabaCacheControl | undefined;
}

export class CacheControlValidator {
  private breakpointCount = 0;
  private warnings: SharedV4Warning[] = [];

  getCacheControl(
    providerMetadata: SharedV4ProviderMetadata | undefined,
  ): AlibabaCacheControl | undefined {
    const cacheControlValue = getCacheControl(providerMetadata);

    if (!cacheControlValue) {
      return undefined;
    }

    this.breakpointCount++;
    if (this.breakpointCount > MAX_CACHE_BREAKPOINTS) {
      this.warnings.push({
        type: 'other',
        message: `Max breakpoint limit exceeded. Only the last ${MAX_CACHE_BREAKPOINTS} cache markers will take effect.`,
      });
    }

    return cacheControlValue;
  }

  getWarnings(): SharedV4Warning[] {
    return this.warnings;
  }
}
