import type { SkillsV4, SharedV4Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  convertInlineFileDataToUint8Array,
  createJsonResponseHandler,
  postFormDataToApi,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { openaiFailedResponseHandler } from '../openai-error';
import { openaiSkillResponseSchema } from './openai-skills-api';

interface OpenAISkillsConfig {
  provider: string;
  url: (options: { path: string }) => string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
}

export class OpenAISkills implements SkillsV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  constructor(private readonly config: OpenAISkillsConfig) {}

  async uploadSkill(
    params: Parameters<SkillsV4['uploadSkill']>[0],
  ): Promise<Awaited<ReturnType<SkillsV4['uploadSkill']>>> {
    const warnings: SharedV4Warning[] = [];

    if (params.displayTitle != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'displayTitle',
      });
    }

    const formData = new FormData();

    for (const file of params.files) {
      const content = convertInlineFileDataToUint8Array(file.data);
      formData.append('files[]', new Blob([content]), file.path);
    }

    const { value: response } = await postFormDataToApi({
      url: this.config.url({ path: '/skills' }),
      headers: combineHeaders(this.config.headers()),
      formData,
      failedResponseHandler: openaiFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        openaiSkillResponseSchema,
      ),
      fetch: this.config.fetch,
    });

    return {
      providerReference: { openai: response.id },
      ...(response.name != null ? { name: response.name } : {}),
      ...(response.description != null
        ? { description: response.description }
        : {}),
      ...(response.latest_version != null
        ? { latestVersion: response.latest_version }
        : {}),
      providerMetadata: {
        openai: {
          ...(response.default_version != null
            ? { defaultVersion: response.default_version }
            : {}),
          ...(response.created_at != null
            ? { createdAt: response.created_at }
            : {}),
          ...(response.updated_at != null
            ? { updatedAt: response.updated_at }
            : {}),
        },
      },
      warnings,
    };
  }
}
