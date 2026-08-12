import { describe, it, expect, vi } from 'vitest';
import { createReplicate } from './replicate-provider';
import { ReplicateImageModel } from './replicate-image-model';
import { ReplicateVideoModel } from './replicate-video-model';

vi.mock('./replicate-video-model', () => ({
  ReplicateVideoModel: vi.fn(),
}));

describe('createReplicate', () => {
  it('creates a provider with required settings', () => {
    const provider = createReplicate({ apiToken: 'test-token' });
    expect(provider.image).toBeDefined();
  });

  it('creates a provider with custom settings', () => {
    const provider = createReplicate({
      apiToken: 'test-token',
      baseURL: 'https://custom.replicate.com',
    });
    expect(provider.image).toBeDefined();
  });

  it('creates an image model instance', () => {
    const provider = createReplicate({ apiToken: 'test-token' });
    const model = provider.image('black-forest-labs/flux-schnell');
    expect(model).toBeInstanceOf(ReplicateImageModel);
  });
});

describe('createReplicate - video', () => {
  it('creates a video model instance', () => {
    const provider = createReplicate({ apiToken: 'test-token' });
    provider.video('stability-ai/stable-video-diffusion:abc123');

    expect(ReplicateVideoModel).toHaveBeenCalledWith(
      'stability-ai/stable-video-diffusion:abc123',
      expect.objectContaining({
        provider: 'replicate.video',
        baseURL: 'https://api.replicate.com/v1',
      }),
    );
  });

  it('uses custom baseURL for video model when provided', () => {
    const provider = createReplicate({
      apiToken: 'test-token',
      baseURL: 'https://custom.replicate.com/v1',
    });
    provider.video('minimax/video-01');

    expect(ReplicateVideoModel).toHaveBeenCalledWith(
      'minimax/video-01',
      expect.objectContaining({
        provider: 'replicate.video',
        baseURL: 'https://custom.replicate.com/v1',
      }),
    );
  });

  it('passes custom fetch to video model', () => {
    const customFetch = vi.fn();
    const provider = createReplicate({
      apiToken: 'test-token',
      fetch: customFetch,
    });
    provider.video('minimax/video-01');

    expect(ReplicateVideoModel).toHaveBeenCalledWith(
      'minimax/video-01',
      expect.objectContaining({
        fetch: customFetch,
      }),
    );
  });
});
