import type { SkillsV4, SharedV4Warning } from '@ai-sdk/provider';
import {
  combineHeaders,
  convertInlineFileDataToUint8Array,
  createJsonResponseHandler,
  getFromApi,
  postFormDataToApi,
  resolve,
  type FetchFunction,
  type Resolvable,
} from '@ai-sdk/provider-utils';
import { anthropicFailedResponseHandler } from '../anthropic-error';
import {
  anthropicSkillResponseSchema,
  anthropicSkillVersionResponseSchema,
} from './anthropic-skills-api';

interface AnthropicSkillsConfig {
  provider: string;
  baseURL: string;
  headers: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
}

export class AnthropicSkills implements SkillsV4 {
  readonly specificationVersion = 'v4';

  get provider(): string {
    return this.config.provider;
  }

  constructor(private readonly config: AnthropicSkillsConfig) {}

  private async getHeaders(): Promise<Record<string, string | undefined>> {
    return combineHeaders(await resolve(this.config.headers), {
      'anthropic-beta': 'skills-2025-10-02',
    });
  }

  private async fetchVersionMetadata({
    skillId,
    version,
    headers,
  }: {
    skillId: string;
    version: string;
    headers: Record<string, string | undefined>;
  }): Promise<{ name?: string; description?: string }> {
    const { value: versionResponse } = await getFromApi({
      url: `${this.config.baseURL}/skills/${skillId}/versions/${version}`,
      headers,
      failedResponseHandler: anthropicFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        anthropicSkillVersionResponseSchema,
      ),
      fetch: this.config.fetch,
    });

    return {
      ...(versionResponse.name != null ? { name: versionResponse.name } : {}),
      ...(versionResponse.description != null
        ? { description: versionResponse.description }
        : {}),
    };
  }

  async uploadSkill(
    params: Parameters<SkillsV4['uploadSkill']>[0],
  ): Promise<Awaited<ReturnType<SkillsV4['uploadSkill']>>> {
    const warnings: SharedV4Warning[] = [];

    const formData = new FormData();

    if (params.displayTitle != null) {
      formData.append('display_title', params.displayTitle);
    }

    for (const file of params.files) {
      const content = convertInlineFileDataToUint8Array(file.data);
      formData.append('files[]', new Blob([content]), file.path);
    }

    const headers = await this.getHeaders();

    const { value: response } = await postFormDataToApi({
      url: `${this.config.baseURL}/skills`,
      headers,
      formData,
      failedResponseHandler: anthropicFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        anthropicSkillResponseSchema,
      ),
      fetch: this.config.fetch,
    });

    const versionMetadata =
      response.latest_version != null
        ? await this.fetchVersionMetadata({
            skillId: response.id,
            version: response.latest_version,
            headers,
          })
        : {};

    const name = versionMetadata.name ?? response.name;
    const description = versionMetadata.description ?? response.description;

    return {
      providerReference: { anthropic: response.id },
      ...(response.display_title != null
        ? { displayTitle: response.display_title }
        : {}),
      ...(name != null ? { name } : {}),
      ...(description != null ? { description } : {}),
      ...(response.latest_version != null
        ? { latestVersion: response.latest_version }
        : {}),
      providerMetadata: {
        anthropic: {
          ...(response.source != null ? { source: response.source } : {}),
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
