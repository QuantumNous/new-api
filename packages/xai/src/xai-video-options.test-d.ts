import { describe, expectTypeOf, it } from 'vitest';
import type { XaiVideoModelOptions } from '.';

describe('XaiVideoModelOptions type', () => {
  // ── Explicit modes accepted ────────────────────────────────────────

  it('should allow edit-video mode with videoUrl', () => {
    const options = {
      mode: 'edit-video',
      videoUrl: 'https://example.com/video.mp4',
      pollIntervalMs: 1000,
    } satisfies XaiVideoModelOptions;

    expectTypeOf(options).toMatchTypeOf<XaiVideoModelOptions>();
  });

  it('should allow extend-video mode with videoUrl', () => {
    const options = {
      mode: 'extend-video',
      videoUrl: 'https://example.com/video.mp4',
      pollTimeoutMs: 1000,
    } satisfies XaiVideoModelOptions;

    expectTypeOf(options).toMatchTypeOf<XaiVideoModelOptions>();
  });

  it('should allow reference-to-video mode with referenceImageUrls', () => {
    const options = {
      mode: 'reference-to-video',
      referenceImageUrls: ['https://example.com/ref.png'],
      resolution: '720p',
    } satisfies XaiVideoModelOptions;

    expectTypeOf(options).toMatchTypeOf<XaiVideoModelOptions>();
  });

  it('should allow reference-to-video with multiple hardcoded URLs', () => {
    const options = {
      mode: 'reference-to-video',
      referenceImageUrls: [
        'https://example.com/a.png',
        'https://example.com/b.png',
        'https://example.com/c.png',
      ],
      pollTimeoutMs: 600000,
    } satisfies XaiVideoModelOptions;

    expectTypeOf(options).toMatchTypeOf<XaiVideoModelOptions>();
  });

  // ── Plain generation + legacy no-mode compatibility ────────────────

  it('should allow generic video options without mode', () => {
    const options = {
      pollIntervalMs: 1000,
      resolution: '480p',
    } satisfies XaiVideoModelOptions;

    expectTypeOf(options).toMatchTypeOf<XaiVideoModelOptions>();
  });

  it('should allow an explicitly undefined mode for plain generation', () => {
    const options = {
      mode: undefined,
      pollTimeoutMs: 600000,
    } satisfies XaiVideoModelOptions;

    expectTypeOf(options).toMatchTypeOf<XaiVideoModelOptions>();
  });

  it('should allow videoUrl without mode for backward compatibility', () => {
    const options = {
      videoUrl: 'https://example.com/video.mp4',
    } satisfies XaiVideoModelOptions;

    expectTypeOf(options).toMatchTypeOf<XaiVideoModelOptions>();
  });

  it('should allow referenceImageUrls without mode for backward compatibility', () => {
    const options = {
      referenceImageUrls: ['https://example.com/ref.png'],
    } satisfies XaiVideoModelOptions;

    expectTypeOf(options).toMatchTypeOf<XaiVideoModelOptions>();
  });

  it('should allow explicitly undefined fields on plain generation shape', () => {
    const options = {
      videoUrl: undefined,
      referenceImageUrls: undefined,
    } satisfies XaiVideoModelOptions;

    expectTypeOf(options).toMatchTypeOf<XaiVideoModelOptions>();
  });

  it('should allow explicitly undefined mode with legacy backward-compatible fields', () => {
    const editOptions = {
      mode: undefined,
      videoUrl: 'https://example.com/video.mp4',
    } satisfies XaiVideoModelOptions;

    const referenceOptions = {
      mode: undefined,
      referenceImageUrls: ['https://example.com/ref.png'],
    } satisfies XaiVideoModelOptions;

    expectTypeOf(editOptions).toMatchTypeOf<XaiVideoModelOptions>();
    expectTypeOf(referenceOptions).toMatchTypeOf<XaiVideoModelOptions>();
  });

  // ── Discriminated union: illegal combos rejected ───────────────────

  it('should not allow referenceImageUrls with edit-video mode', () => {
    const options: XaiVideoModelOptions = {
      mode: 'edit-video',
      videoUrl: 'https://example.com/video.mp4',
      // @ts-expect-error - edit-video does not accept referenceImageUrls
      referenceImageUrls: ['https://example.com/ref.png'],
    };

    options;
  });

  it('should not allow referenceImageUrls with extend-video mode', () => {
    const options: XaiVideoModelOptions = {
      mode: 'extend-video',
      videoUrl: 'https://example.com/video.mp4',
      // @ts-expect-error - extend-video does not accept referenceImageUrls
      referenceImageUrls: ['https://example.com/ref.png'],
    };

    options;
  });

  it('should not allow videoUrl with reference-to-video mode', () => {
    const options: XaiVideoModelOptions = {
      mode: 'reference-to-video',
      referenceImageUrls: ['https://example.com/ref.png'],
      // @ts-expect-error - reference-to-video does not accept videoUrl
      videoUrl: 'https://example.com/video.mp4',
    };

    options;
  });

  // ── Required companion fields ──────────────────────────────────────

  it('should not allow edit-video without videoUrl', () => {
    // @ts-expect-error - edit-video requires videoUrl
    const options: XaiVideoModelOptions = {
      mode: 'edit-video',
    };

    options;
  });

  it('should not allow extend-video without videoUrl', () => {
    // @ts-expect-error - extend-video requires videoUrl
    const options: XaiVideoModelOptions = {
      mode: 'extend-video',
    };

    options;
  });

  it('should not allow reference-to-video without referenceImageUrls', () => {
    // @ts-expect-error - reference-to-video requires referenceImageUrls
    const options: XaiVideoModelOptions = {
      mode: 'reference-to-video',
    };

    options;
  });

  it('should not allow reference-to-video with only shared fields', () => {
    // @ts-expect-error - reference-to-video still requires referenceImageUrls even with shared options
    const options: XaiVideoModelOptions = {
      mode: 'reference-to-video',
      pollTimeoutMs: 600000,
    };

    options;
  });
});
