import { stringifyForTelemetry } from './stringify-for-telemetry';
import type { LanguageModelV4Prompt } from '@ai-sdk/provider';
import { describe, it, expect } from 'vitest';

describe('stringifyForTelemetry', () => {
  it('should stringify a prompt with text parts', () => {
    const prompt: LanguageModelV4Prompt = [
      { role: 'system', content: 'You are a helpful assistant.' },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello!' }],
      },
    ];

    const result = stringifyForTelemetry(prompt);

    expect(result).toMatchInlineSnapshot(
      `"[{"role":"system","content":"You are a helpful assistant."},{"role":"user","content":[{"type":"text","text":"Hello!"}]}]"`,
    );
  });

  it('should convert Uint8Array images to base64 strings', () => {
    const result = stringifyForTelemetry([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xff]),
            },
            mediaType: 'image/png',
          },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(
      `"[{"role":"user","content":[{"type":"file","data":"iVBOR///","mediaType":"image/png"}]}]"`,
    );
  });

  it('should preserve the file name and provider options', () => {
    const result = stringifyForTelemetry([
      {
        role: 'user',
        content: [
          {
            type: 'file',
            filename: 'image.png',
            data: {
              type: 'data' as const,
              data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xff]),
            },
            mediaType: 'image/png',
            providerOptions: {
              anthropic: {
                key: 'value',
              },
            },
          },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(
      `"[{"role":"user","content":[{"type":"file","filename":"image.png","data":"iVBOR///","mediaType":"image/png","providerOptions":{"anthropic":{"key":"value"}}}]}]"`,
    );
  });

  it('should keep URL images as is', () => {
    const result = stringifyForTelemetry([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Check this image:' },
          {
            type: 'file',
            data: {
              type: 'url' as const,
              url: new URL('https://example.com/image.jpg'),
            },
            mediaType: 'image/jpeg',
          },
        ],
      },
    ]);

    expect(result).toMatchInlineSnapshot(
      `"[{"role":"user","content":[{"type":"text","text":"Check this image:"},{"type":"file","data":"https://example.com/image.jpg","mediaType":"image/jpeg"}]}]"`,
    );
  });

  it('should handle a mixed prompt with various content types', () => {
    const result = stringifyForTelemetry([
      { role: 'system', content: 'You are a helpful assistant.' },
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: {
              type: 'data' as const,
              data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xff]),
            },
            mediaType: 'image/png',
          },
          {
            type: 'file',
            data: {
              type: 'url' as const,
              url: new URL('https://example.com/image.jpg'),
            },
            mediaType: 'image/jpeg',
          },
        ],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'I see the images!' }],
      },
    ]);

    expect(result).toMatchInlineSnapshot(
      `"[{"role":"system","content":"You are a helpful assistant."},{"role":"user","content":[{"type":"file","data":"iVBOR///","mediaType":"image/png"},{"type":"file","data":"https://example.com/image.jpg","mediaType":"image/jpeg"}]},{"role":"assistant","content":[{"type":"text","text":"I see the images!"}]}]"`,
    );
  });
});
