import type { ProviderMetadata } from '../types/provider-metadata';
import type { ProviderReference } from '../types/provider-reference';
import type { Warning } from '../types/warning';

export interface UploadFileResult {
  readonly providerReference: ProviderReference;
  readonly mediaType?: string;
  readonly filename?: string;
  readonly providerMetadata?: ProviderMetadata;
  readonly warnings: Array<Warning>;
}
