import type { SharedV4ProviderMetadata } from '../../shared/v4/shared-v4-provider-metadata';
import type { SharedV4ProviderReference } from '../../shared/v4/shared-v4-provider-reference';
import type { SharedV4Warning } from '../../shared/v4/shared-v4-warning';

export interface SkillsV4UploadSkillResult {
  /**
   * A provider reference mapping provider names to provider-specific skill identifiers.
   */
  providerReference: SharedV4ProviderReference;

  /**
   * Optional human-readable title for the uploaded skill.
   */
  displayTitle?: string;

  /**
   * Optional name of the uploaded skill.
   */
  name?: string;

  /**
   * Optional description of what the uploaded skill does.
   */
  description?: string;

  /**
   * Optional latest version identifier of the uploaded skill.
   */
  latestVersion?: string;

  /**
   * Additional provider-specific metadata.
   */
  providerMetadata?: SharedV4ProviderMetadata;

  /**
   * Warnings for the call, e.g. unsupported settings.
   */
  warnings: SharedV4Warning[];
}
