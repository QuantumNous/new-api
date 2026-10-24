import fs from 'node:fs';

import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils';
import { describe, it, expect, vi } from 'vitest';
import { createAnthropic } from '../anthropic-provider';

vi.mock('../version', () => ({
  VERSION: '0.0.0-test',
}));

const provider = createAnthropic({
  apiKey: 'test-api-key',
  baseURL: 'https://api.anthropic.com/v1',
});

const server = createTestServer({
  'https://api.anthropic.com/v1/skills': {},
  'https://api.anthropic.com/v1/skills/:skillId/versions/:versionId': {},
});

const testFileContent = new TextEncoder().encode('console.log("hello")');
const testFileContentBase64 = convertUint8ArrayToBase64(testFileContent);

function prepareResponse({
  url,
  filename,
  headers,
}: {
  url: keyof typeof server.urls;
  filename: string;
  headers?: Record<string, string>;
}) {
  server.urls[url].response = {
    type: 'json-value',
    headers,
    body: JSON.parse(
      fs.readFileSync(`src/skills/__fixtures__/${filename}.json`, 'utf8'),
    ),
  };
}

function prepareVersionMetadataResponse() {
  prepareResponse({
    url: 'https://api.anthropic.com/v1/skills/:skillId/versions/:versionId',
    filename: 'anthropic-skill-version-create',
  });
}

describe('AnthropicSkills', () => {
  describe('uploadSkill', () => {
    it('should send files as multipart form data', async () => {
      prepareResponse({
        url: 'https://api.anthropic.com/v1/skills',
        filename: 'anthropic-skill-create',
      });
      prepareVersionMetadataResponse();

      const skills = provider.skills();
      await skills.uploadSkill({
        files: [
          {
            path: 'index.ts',
            data: { type: 'data', data: testFileContentBase64 },
          },
        ],
      });

      const body = await server.calls[0].requestBodyMultipart;
      expect(body).toBeTruthy();
      expect(body!['files[]']).toBeInstanceOf(File);
    });

    it('should include anthropic-beta header', async () => {
      prepareResponse({
        url: 'https://api.anthropic.com/v1/skills',
        filename: 'anthropic-skill-create',
      });
      prepareVersionMetadataResponse();

      const skills = provider.skills();
      await skills.uploadSkill({
        files: [
          {
            path: 'index.ts',
            data: { type: 'data', data: testFileContentBase64 },
          },
        ],
      });

      expect(server.calls[0].requestHeaders).toMatchObject({
        'anthropic-beta': 'skills-2025-10-02',
        'x-api-key': 'test-api-key',
      });
    });

    it('should map response to providerReference', async () => {
      prepareResponse({
        url: 'https://api.anthropic.com/v1/skills',
        filename: 'anthropic-skill-create',
      });
      prepareVersionMetadataResponse();

      const skills = provider.skills();
      const result = await skills.uploadSkill({
        files: [
          {
            path: 'index.ts',
            data: { type: 'data', data: testFileContentBase64 },
          },
        ],
      });

      expect(result.providerReference).toEqual({
        anthropic: 'skill_01Xud7kLMsjLfc7Aa6RvigZf',
      });
      expect(result.displayTitle).toBe('Test Capture Skill');
      expect(result.name).toBe('test-capture-skill');
      expect(result.description).toBe(
        'An updated test skill for fixture capture',
      );
      expect(result.latestVersion).toBe('1772078378207930');
      expect(result.providerMetadata).toEqual({
        anthropic: {
          source: 'custom',
          createdAt: '2026-02-26T03:59:39.314772Z',
          updatedAt: '2026-02-26T03:59:39.314772Z',
        },
      });
    });

    it('should send display_title in form data when displayTitle is provided', async () => {
      prepareResponse({
        url: 'https://api.anthropic.com/v1/skills',
        filename: 'anthropic-skill-create',
      });
      prepareVersionMetadataResponse();

      const skills = provider.skills();
      await skills.uploadSkill({
        files: [
          {
            path: 'index.ts',
            data: { type: 'data', data: testFileContentBase64 },
          },
        ],
        displayTitle: 'My Custom Title',
      });

      const body = await server.calls[0].requestBodyMultipart;
      expect(body!.display_title).toBe('My Custom Title');
    });

    it('should not send display_title when displayTitle is not provided', async () => {
      prepareResponse({
        url: 'https://api.anthropic.com/v1/skills',
        filename: 'anthropic-skill-create',
      });
      prepareVersionMetadataResponse();

      const skills = provider.skills();
      await skills.uploadSkill({
        files: [
          {
            path: 'index.ts',
            data: { type: 'data', data: testFileContentBase64 },
          },
        ],
      });

      const body = await server.calls[0].requestBodyMultipart;
      expect(body!.display_title).toBeUndefined();
    });

    it('should return no warnings', async () => {
      prepareResponse({
        url: 'https://api.anthropic.com/v1/skills',
        filename: 'anthropic-skill-create',
      });
      prepareVersionMetadataResponse();

      const skills = provider.skills();
      const result = await skills.uploadSkill({
        files: [
          {
            path: 'index.ts',
            data: { type: 'data', data: testFileContentBase64 },
          },
        ],
      });

      expect(result.warnings).toMatchInlineSnapshot(`[]`);
    });
  });
});
