import { NoSuchProviderReferenceError } from '@ai-sdk/provider';
import { resolveProviderReference } from './resolve-provider-reference';
import { describe, it, expect } from 'vitest';

describe('resolveProviderReference', () => {
  it('should return the provider-specific identifier when the provider key exists', () => {
    const result = resolveProviderReference({
      reference: { openai: 'file-abc', anthropic: 'file-xyz' },
      provider: 'openai',
    });
    expect(result).toBe('file-abc');
  });

  it('should return the correct identifier for a different provider', () => {
    const result = resolveProviderReference({
      reference: { openai: 'file-abc', anthropic: 'file-xyz' },
      provider: 'anthropic',
    });
    expect(result).toBe('file-xyz');
  });

  it('should throw NoSuchProviderReferenceError when no entry exists for the given provider', () => {
    try {
      resolveProviderReference({
        reference: { anthropic: 'file-xyz', google: 'file-123' },
        provider: 'openai',
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(NoSuchProviderReferenceError.isInstance(error)).toBe(true);
      expect((error as NoSuchProviderReferenceError).provider).toBe('openai');
      expect((error as NoSuchProviderReferenceError).reference).toStrictEqual({
        anthropic: 'file-xyz',
        google: 'file-123',
      });
    }
  });

  it('should throw NoSuchProviderReferenceError when reference is empty', () => {
    try {
      resolveProviderReference({
        reference: {},
        provider: 'openai',
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(NoSuchProviderReferenceError.isInstance(error)).toBe(true);
      expect((error as NoSuchProviderReferenceError).provider).toBe('openai');
      expect((error as NoSuchProviderReferenceError).reference).toStrictEqual(
        {},
      );
    }
  });

  it('should work with a single-provider reference', () => {
    const result = resolveProviderReference({
      reference: { openai: 'file-only' },
      provider: 'openai',
    });
    expect(result).toBe('file-only');
  });
});
