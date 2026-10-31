import type { ProviderV4, SkillsV4 } from '@ai-sdk/provider';
import { describe, it, expect, vi } from 'vitest';
import { uploadSkill } from './upload-skill';

function createMockSkills(overrides: Partial<SkillsV4> = {}): SkillsV4 {
  return {
    specificationVersion: 'v4',
    provider: 'mock-provider',
    uploadSkill: vi.fn().mockResolvedValue({
      providerReference: { 'mock-provider': 'skill_123' },
      warnings: [],
    }),
    ...overrides,
  };
}

describe('uploadSkill', () => {
  it('should delegate to api.uploadSkill', async () => {
    const skills = createMockSkills();

    const files = [
      { path: 'test.ts', data: { type: 'data' as const, data: 'hello' } },
    ];
    await uploadSkill({
      api: skills,
      files,
      displayTitle: 'My Skill',
    });

    expect(skills.uploadSkill).toHaveBeenCalledWith({
      files,
      displayTitle: 'My Skill',
      providerOptions: undefined,
    });
  });

  it('should return providerReference and warnings from the skills', async () => {
    const skills = createMockSkills({
      uploadSkill: vi.fn().mockResolvedValue({
        providerReference: { 'mock-provider': 'skill_123' },
        warnings: [{ type: 'unsupported', feature: 'displayTitle' }],
        providerMetadata: { foo: 'bar' },
      }),
    });

    const result = await uploadSkill({
      api: skills,
      files: [
        { path: 'test.ts', data: { type: 'data' as const, data: 'hello' } },
      ],
    });

    expect(result.providerReference).toEqual({ 'mock-provider': 'skill_123' });
    expect(result.warnings).toMatchInlineSnapshot(`
      [
        {
          "feature": "displayTitle",
          "type": "unsupported",
        },
      ]
    `);
    expect(result.providerMetadata).toEqual({ foo: 'bar' });
  });

  it('should resolve SkillsV4 from ProviderV4 with skills() method', async () => {
    const skills = createMockSkills();
    const mockProvider = {
      specificationVersion: 'v4' as const,
      languageModel: vi.fn(),
      embeddingModel: vi.fn(),
      imageModel: vi.fn(),
      skills: vi.fn().mockReturnValue(skills),
    } satisfies ProviderV4;

    await uploadSkill({
      api: mockProvider,
      files: [
        { path: 'test.ts', data: { type: 'data' as const, data: 'hello' } },
      ],
    });

    expect(mockProvider.skills).toHaveBeenCalled();
    expect(skills.uploadSkill).toHaveBeenCalled();
  });

  it('should throw when ProviderV4 has no skills() method', async () => {
    const mockProvider = {
      specificationVersion: 'v4' as const,
      languageModel: vi.fn(),
      embeddingModel: vi.fn(),
      imageModel: vi.fn(),
    } satisfies ProviderV4;

    await expect(
      uploadSkill({
        api: mockProvider,
        files: [
          { path: 'test.ts', data: { type: 'data' as const, data: 'hello' } },
        ],
      }),
    ).rejects.toThrow(
      'The provider does not support skills. Make sure it exposes a skills() method.',
    );
  });

  it('should pass providerOptions to the skills', async () => {
    const skills = createMockSkills();

    await uploadSkill({
      api: skills,
      files: [
        { path: 'test.ts', data: { type: 'data' as const, data: 'hello' } },
      ],
      providerOptions: { openai: { custom: 'value' } },
    });

    expect(skills.uploadSkill).toHaveBeenCalledWith({
      files: [
        { path: 'test.ts', data: { type: 'data' as const, data: 'hello' } },
      ],
      displayTitle: undefined,
      providerOptions: { openai: { custom: 'value' } },
    });
  });
});
