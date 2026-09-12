import { describe, it, expect } from 'vitest';
import { CacheControlValidator } from './get-cache-control';

describe('CacheControlValidator', () => {
  it('should extract cacheControl from providerMetadata', () => {
    const validator = new CacheControlValidator();

    const result = validator.getCacheControl({
      alibaba: {
        cacheControl: { type: 'ephemeral' },
      },
    });

    expect(result).toEqual({ type: 'ephemeral' });
  });

  it('should warn when exceeding 4 cache breakpoints', () => {
    const validator = new CacheControlValidator();

    for (let i = 0; i < 4; i++) {
      validator.getCacheControl({
        alibaba: { cacheControl: { type: 'ephemeral' } },
      });
    }

    const result = validator.getCacheControl({
      alibaba: { cacheControl: { type: 'ephemeral' } },
    });

    expect(result).toEqual({ type: 'ephemeral' });
    expect(validator.getWarnings()).toHaveLength(1);
    expect(validator.getWarnings()[0]).toMatchInlineSnapshot(`
      {
        "message": "Max breakpoint limit exceeded. Only the last 4 cache markers will take effect.",
        "type": "other",
      }
    `);
  });

  it('should return undefined when no cache control is present', () => {
    const validator = new CacheControlValidator();

    const result = validator.getCacheControl({
      alibaba: {},
    });

    expect(result).toBeUndefined();
  });
});
