import type {
  SharedV4FileDataData,
  SharedV4FileDataText,
} from '../../shared/v4/shared-v4-file-data';
import type { SharedV4ProviderOptions } from '../../shared/v4/shared-v4-provider-options';

export interface SkillsV4File {
  /**
   * The path of the file relative to the skill root.
   */
  path: string;

  /**
   * The file data.
   *
   * - `{ type: 'data', data }`: raw bytes (`Uint8Array`) or a base64-encoded string.
   * - `{ type: 'text', text }`: inline text (UTF-8).
   */
  data: SharedV4FileDataData | SharedV4FileDataText;
}

export interface SkillsV4UploadSkillCallOptions {
  /**
   * The files that make up the skill.
   */
  files: SkillsV4File[];

  /**
   * Optional human-readable title for the skill.
   */
  displayTitle?: string;

  /**
   * Additional provider-specific options.
   */
  providerOptions?: SharedV4ProviderOptions;
}
