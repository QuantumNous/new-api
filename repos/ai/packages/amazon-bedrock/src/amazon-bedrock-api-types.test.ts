import { createAmazonBedrockCachePoint } from './amazon-bedrock-api-types';
import { describe, it, expect } from 'vitest';

describe('createAmazonBedrockCachePoint', () => {
  it('should return default cache point when no TTL is provided', () => {
    const result = createAmazonBedrockCachePoint();

    expect(result).toEqual({ cachePoint: { type: 'default' } });
  });

  it('should create cache point with 5m TTL', () => {
    const result = createAmazonBedrockCachePoint('5m');

    expect(result).toEqual({ cachePoint: { type: 'default', ttl: '5m' } });
  });

  it('should create cache point with 1h TTL', () => {
    const result = createAmazonBedrockCachePoint('1h');

    expect(result).toEqual({ cachePoint: { type: 'default', ttl: '1h' } });
  });
});
