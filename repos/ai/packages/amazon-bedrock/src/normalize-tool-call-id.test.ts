import { describe, it, expect } from 'vitest';
import { isMistralModel, normalizeToolCallId } from './normalize-tool-call-id';

describe('isMistralModel', () => {
  it('should return true for mistral models', () => {
    expect(isMistralModel('mistral.mistral-7b-instruct-v0:2')).toBe(true);
    expect(isMistralModel('mistral.mixtral-8x7b-instruct-v0:1')).toBe(true);
    expect(isMistralModel('mistral.mistral-large-2402-v1:0')).toBe(true);
    expect(isMistralModel('mistral.mistral-small-2402-v1:0')).toBe(true);
    expect(isMistralModel('mistral.mistral-large-2407-v1:0')).toBe(true);
    expect(isMistralModel('mistral.ministral-3-14b-instruct')).toBe(true);
    expect(isMistralModel('mistral.ministral-3-8b-instruct')).toBe(true);
  });

  it('should return true for region-prefixed mistral models', () => {
    expect(isMistralModel('us.mistral.pixtral-large-2502-v1:0')).toBe(true);
    expect(isMistralModel('eu.mistral.mistral-large-2407-v1:0')).toBe(true);
  });

  it('should return false for non-mistral models', () => {
    expect(isMistralModel('anthropic.claude-3-5-sonnet-20241022-v2:0')).toBe(
      false,
    );
    expect(isMistralModel('amazon.nova-pro-v1:0')).toBe(false);
    expect(isMistralModel('openai.gpt-4o')).toBe(false);
    expect(isMistralModel('meta.llama3-70b-instruct-v1:0')).toBe(false);
  });
});

describe('normalizeToolCallId', () => {
  it('should return the original ID when not a Mistral model', () => {
    const originalId = 'tooluse_bpe71yCfRu2b5i-nKGDr5g';
    expect(normalizeToolCallId(originalId, false)).toBe(originalId);
  });

  it('should extract first 9 alphanumeric characters for Mistral models', () => {
    // Bedrock format: tooluse_bpe71yCfRu2b5i-nKGDr5g
    // After removing non-alphanumeric: toolusebpe71yCfRu2b5inKGDr5g
    // First 9 chars: toolusebp
    expect(normalizeToolCallId('tooluse_bpe71yCfRu2b5i-nKGDr5g', true)).toBe(
      'toolusebp',
    );
  });

  it('should handle IDs with various special characters', () => {
    expect(normalizeToolCallId('tool-use_123ABC456', true)).toBe('tooluse12');
    expect(normalizeToolCallId('___abc123DEF___', true)).toBe('abc123DEF');
  });

  it('should handle IDs that are already alphanumeric', () => {
    expect(normalizeToolCallId('abcdefghi', true)).toBe('abcdefghi');
    expect(normalizeToolCallId('abc123XYZ', true)).toBe('abc123XYZ');
  });

  it('should handle short IDs', () => {
    expect(normalizeToolCallId('abc', true)).toBe('abc');
    expect(normalizeToolCallId('12345', true)).toBe('12345');
  });

  it('should handle IDs with only special characters', () => {
    expect(normalizeToolCallId('___---___', true)).toBe('');
  });

  it('should produce valid Mistral tool call IDs (9 alphanumeric chars)', () => {
    const normalizedId = normalizeToolCallId(
      'tooluse_bpe71yCfRu2b5i-nKGDr5g',
      true,
    );
    // Verify the ID matches Mistral's requirements: ^[a-zA-Z0-9]{1,9}$
    expect(normalizedId).toMatch(/^[a-zA-Z0-9]{1,9}$/);
  });
});
