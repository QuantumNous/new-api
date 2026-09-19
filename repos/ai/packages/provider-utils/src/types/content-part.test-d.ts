import { describe, expectTypeOf, it } from 'vitest';
import type { DataContent } from './data-content';
import type {
  FilePart,
  ReasoningFilePart,
  ToolResultOutput,
} from './content-part';
import type { ProviderReference } from './provider-reference';

type ToolResultContentItem = Extract<
  ToolResultOutput,
  { type: 'content' }
>['value'][number];
type ToolResultFilePart = Extract<ToolResultContentItem, { type: 'file' }>;
type ToolResultFileUrlPart = Extract<
  ToolResultContentItem,
  { type: 'file-url' }
>;
type ToolResultFileDataPart = Extract<
  ToolResultContentItem,
  { type: 'file-data' }
>;
type ToolResultFileReferencePart = Extract<
  ToolResultContentItem,
  { type: 'file-reference' }
>;
type ToolResultImageDataPart = Extract<
  ToolResultContentItem,
  { type: 'image-data' }
>;
type ToolResultImageUrlPart = Extract<
  ToolResultContentItem,
  { type: 'image-url' }
>;

type TaggedFileData = Extract<FilePart['data'], { type: string }>;
type TaggedReasoningFileData = Extract<
  ReasoningFilePart['data'],
  { type: string }
>;

describe('FilePart.data', () => {
  it('narrows exhaustively across the 4 tagged arms', () => {
    const data = null as unknown as TaggedFileData;

    switch (data.type) {
      case 'data': {
        expectTypeOf(data.data).toEqualTypeOf<DataContent>();
        break;
      }
      case 'url': {
        expectTypeOf(data.url).toEqualTypeOf<URL>();
        break;
      }
      case 'reference': {
        expectTypeOf(data.reference).toEqualTypeOf<ProviderReference>();
        break;
      }
      case 'text': {
        expectTypeOf(data.text).toEqualTypeOf<string>();
        break;
      }
      default: {
        const _exhaustive: never = data;
        return _exhaustive;
      }
    }
  });

  it('exposes exactly 4 tagged `type` discriminants', () => {
    expectTypeOf<TaggedFileData['type']>().toEqualTypeOf<
      'data' | 'url' | 'reference' | 'text'
    >();
  });

  it('accepts the tagged `data` arm', () => {
    expectTypeOf<{
      type: 'file';
      data: { type: 'data'; data: Uint8Array };
      mediaType: string;
    }>().toMatchTypeOf<FilePart>();
  });

  it('accepts the tagged `url` arm', () => {
    expectTypeOf<{
      type: 'file';
      data: { type: 'url'; url: URL };
      mediaType: string;
    }>().toMatchTypeOf<FilePart>();
  });

  it('accepts the tagged `reference` arm', () => {
    expectTypeOf<{
      type: 'file';
      data: { type: 'reference'; reference: ProviderReference };
      mediaType: string;
    }>().toMatchTypeOf<FilePart>();
  });

  it('accepts the tagged `text` arm', () => {
    expectTypeOf<{
      type: 'file';
      data: { type: 'text'; text: string };
      mediaType: string;
    }>().toMatchTypeOf<FilePart>();
  });

  it('also accepts bare DataContent, URL, and ProviderReference shorthands', () => {
    expectTypeOf<{
      type: 'file';
      data: Uint8Array;
      mediaType: string;
    }>().toMatchTypeOf<FilePart>();

    expectTypeOf<{
      type: 'file';
      data: string;
      mediaType: string;
    }>().toMatchTypeOf<FilePart>();

    expectTypeOf<{
      type: 'file';
      data: URL;
      mediaType: string;
    }>().toMatchTypeOf<FilePart>();

    expectTypeOf<{
      type: 'file';
      data: ProviderReference;
      mediaType: string;
    }>().toMatchTypeOf<FilePart>();
  });
});

describe('ReasoningFilePart.data', () => {
  it('narrows exhaustively across the 2 tagged arms', () => {
    const data = null as unknown as TaggedReasoningFileData;

    switch (data.type) {
      case 'data': {
        expectTypeOf(data.data).toEqualTypeOf<DataContent>();
        break;
      }
      case 'url': {
        expectTypeOf(data.url).toEqualTypeOf<URL>();
        break;
      }
      default: {
        const _exhaustive: never = data;
        return _exhaustive;
      }
    }
  });

  it('exposes exactly 2 tagged `type` discriminants', () => {
    expectTypeOf<TaggedReasoningFileData['type']>().toEqualTypeOf<
      'data' | 'url'
    >();
  });

  it('accepts the tagged `data` arm', () => {
    expectTypeOf<{
      type: 'reasoning-file';
      data: { type: 'data'; data: Uint8Array };
      mediaType: string;
    }>().toMatchTypeOf<ReasoningFilePart>();
  });

  it('accepts the tagged `url` arm', () => {
    expectTypeOf<{
      type: 'reasoning-file';
      data: { type: 'url'; url: URL };
      mediaType: string;
    }>().toMatchTypeOf<ReasoningFilePart>();
  });

  it('also accepts bare DataContent and URL shorthands', () => {
    expectTypeOf<{
      type: 'reasoning-file';
      data: Uint8Array;
      mediaType: string;
    }>().toMatchTypeOf<ReasoningFilePart>();

    expectTypeOf<{
      type: 'reasoning-file';
      data: URL;
      mediaType: string;
    }>().toMatchTypeOf<ReasoningFilePart>();
  });
});

describe('ToolResultOutput content "file" variant', () => {
  it('accepts the tagged `data` arm with a full mediaType', () => {
    expectTypeOf<{
      type: 'file';
      data: { type: 'data'; data: Uint8Array };
      mediaType: 'image/png';
    }>().toMatchTypeOf<ToolResultFilePart>();
  });

  it('accepts the tagged `url` arm with a top-level mediaType', () => {
    expectTypeOf<{
      type: 'file';
      data: { type: 'url'; url: URL };
      mediaType: 'image';
    }>().toMatchTypeOf<ToolResultFilePart>();
  });

  it('accepts the tagged `reference` arm', () => {
    expectTypeOf<{
      type: 'file';
      data: { type: 'reference'; reference: ProviderReference };
      mediaType: 'application/octet-stream';
    }>().toMatchTypeOf<ToolResultFilePart>();
  });

  it('accepts the tagged `text` arm', () => {
    expectTypeOf<{
      type: 'file';
      data: { type: 'text'; text: string };
      mediaType: 'text/plain';
    }>().toMatchTypeOf<ToolResultFilePart>();
  });

  it('rejects bare data shorthands (tagged-only on tool-result)', () => {
    expectTypeOf<{
      type: 'file';
      data: Uint8Array;
      mediaType: string;
    }>().not.toMatchTypeOf<ToolResultFilePart>();

    expectTypeOf<{
      type: 'file';
      data: URL;
      mediaType: string;
    }>().not.toMatchTypeOf<ToolResultFilePart>();
  });

  it('exposes the four tagged `data.type` discriminants', () => {
    expectTypeOf<ToolResultFilePart['data']['type']>().toEqualTypeOf<
      'data' | 'url' | 'reference' | 'text'
    >();
  });
});

describe('ToolResultOutput content legacy variants', () => {
  it('still type-checks "file-data"', () => {
    expectTypeOf<{
      type: 'file-data';
      data: string;
      mediaType: string;
    }>().toMatchTypeOf<ToolResultFileDataPart>();
  });

  it('still type-checks "file-url" with mediaType', () => {
    expectTypeOf<{
      type: 'file-url';
      url: string;
      mediaType: string;
    }>().toMatchTypeOf<ToolResultFileUrlPart>();
  });

  it('still type-checks "file-url" without mediaType', () => {
    expectTypeOf<{
      type: 'file-url';
      url: string;
    }>().toMatchTypeOf<ToolResultFileUrlPart>();
  });

  it('still type-checks "file-reference"', () => {
    expectTypeOf<{
      type: 'file-reference';
      providerReference: ProviderReference;
    }>().toMatchTypeOf<ToolResultFileReferencePart>();
  });

  it('still type-checks legacy "image-*" variants', () => {
    expectTypeOf<{
      type: 'image-data';
      data: string;
      mediaType: string;
    }>().toMatchTypeOf<ToolResultImageDataPart>();

    expectTypeOf<{
      type: 'image-url';
      url: string;
    }>().toMatchTypeOf<ToolResultImageUrlPart>();
  });
});

describe('ProviderReference (top-level)', () => {
  it('accepts plain provider-id records', () => {
    expectTypeOf<{ openai: 'file-abc' }>().toMatchTypeOf<ProviderReference>();
    expectTypeOf<{ fileId: 'abc' }>().toMatchTypeOf<ProviderReference>();
  });

  it('rejects records that carry a `type` key', () => {
    expectTypeOf<{
      type: 'x';
      openai: 'file-abc';
    }>().not.toMatchTypeOf<ProviderReference>();
  });
});
