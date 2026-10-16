import type { SkillsV4UploadSkillCallOptions } from './skills-v4-upload-skill-call-options';
import type { SkillsV4UploadSkillResult } from './skills-v4-upload-skill-result';

/**
 * Skills specification version 4.
 */
export interface SkillsV4 {
  /**
   * The skills implementation must specify which skills interface
   * version it implements. This will allow us to evolve the skills
   * interface and retain backwards compatibility. The different
   * implementation versions can be handled as a discriminated union
   * on our side.
   */
  readonly specificationVersion: 'v4';

  /**
   * Name of the provider for logging purposes.
   */
  readonly provider: string;

  /**
   * Uploads a new skill from the given files.
   */
  uploadSkill(
    params: SkillsV4UploadSkillCallOptions,
  ): PromiseLike<SkillsV4UploadSkillResult>;
}
