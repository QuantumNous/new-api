import type {
  ProviderV4,
  SkillsV4,
  SkillsV4File,
  SkillsV4UploadSkillCallOptions,
} from '@ai-sdk/provider';
import type { UploadSkillResult } from './upload-skill-result';

type UploadSkillFile = Omit<SkillsV4File, 'data'> & {
  /**
   * The file data. Accepts the tagged `{ type: 'data' | 'text' }` shapes, or
   * the shorthand `Uint8Array | string` (treated as `{ type: 'data', data }`).
   */
  data: SkillsV4File['data'] | Uint8Array | string;
};

export async function uploadSkill({
  api,
  files,
  displayTitle,
  providerOptions,
}: {
  api: SkillsV4 | ProviderV4;
} & Omit<SkillsV4UploadSkillCallOptions, 'files'> & {
    files: UploadSkillFile[];
  }): Promise<UploadSkillResult> {
  const skillsApi: SkillsV4 =
    'uploadSkill' in api
      ? api
      : typeof api.skills === 'function'
        ? api.skills()
        : (() => {
            throw new Error(
              'The provider does not support skills. Make sure it exposes a skills() method.',
            );
          })();

  const normalizedFiles: SkillsV4File[] = files.map(file => ({
    ...file,
    data:
      file.data instanceof Uint8Array || typeof file.data === 'string'
        ? { type: 'data', data: file.data }
        : file.data,
  }));

  const result = await skillsApi.uploadSkill({
    files: normalizedFiles,
    displayTitle,
    providerOptions,
  });

  return result;
}
