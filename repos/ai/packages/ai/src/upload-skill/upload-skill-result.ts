import type { SkillsV4UploadSkillResult } from '@ai-sdk/provider';
import type { ProviderReference } from '../types/provider-reference';
import type { Warning } from '../types/warning';

export type UploadSkillResult = Omit<
  SkillsV4UploadSkillResult,
  'providerReference' | 'warnings'
> & {
  readonly providerReference: ProviderReference;
  readonly warnings: Warning[];
};
