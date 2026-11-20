import type { LanguageModelV4FilePart } from '@ai-sdk/provider';
import {
  isBuffer,
  isProviderReference,
  type DataContent,
  type FilePart,
  type ProviderReference,
} from '@ai-sdk/provider-utils';
import { InvalidDataContentError } from './invalid-data-content-error';
import { splitDataUrl } from './split-data-url';

type TaggedFileData = Extract<FilePart['data'], { type: string }>;

function isTaggedFileData(value: unknown): value is TaggedFileData {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === 'data' || type === 'url' || type === 'reference' || type === 'text'
  );
}

type ConvertResult = {
  data: LanguageModelV4FilePart['data'];
  mediaType: string | undefined;
};

function convertUrlToFilePartData(url: URL): ConvertResult {
  if (url.protocol === 'data:') {
    const { mediaType, base64Content } = splitDataUrl(url.toString());

    if (mediaType == null || base64Content == null) {
      throw new InvalidDataContentError({
        content: url,
        message: `Invalid data URL format in content ${url.toString()}`,
      });
    }

    return { data: { type: 'data', data: base64Content }, mediaType };
  }

  return { data: { type: 'url', url }, mediaType: undefined };
}

function convertInlineDataToFilePartData(content: DataContent): ConvertResult {
  if (content instanceof Uint8Array) {
    return { data: { type: 'data', data: content }, mediaType: undefined };
  }
  if (content instanceof ArrayBuffer) {
    return {
      data: { type: 'data', data: new Uint8Array(content) },
      mediaType: undefined,
    };
  }
  if (isBuffer(content)) {
    return {
      data: { type: 'data', data: new Uint8Array(content) },
      mediaType: undefined,
    };
  }
  return {
    data: { type: 'data', data: content as string },
    mediaType: undefined,
  };
}

/**
 * Converts any legacy-or-tagged top-level `FilePart.data` /
 * `ReasoningFilePart.data` value into the tagged v4 provider prompt shape.
 *
 * Returns the tagged `data` together with the resolved mediaType (extracted
 * from a `data:` URL when applicable).
 */
export function convertToLanguageModelV4FilePart(
  content: FilePart['data'],
): ConvertResult {
  if (isTaggedFileData(content)) {
    switch (content.type) {
      case 'data':
        if (
          typeof content.data === 'string' &&
          content.data.startsWith('data:')
        ) {
          throw new InvalidDataContentError({
            content: content.data,
            message:
              'Data URLs are not valid inline data. Pass them as { type: "url", url } instead.',
          });
        }
        return convertInlineDataToFilePartData(content.data);
      case 'url':
        return convertUrlToFilePartData(content.url);
      case 'reference':
        return {
          data: { type: 'reference', reference: content.reference },
          mediaType: undefined,
        };
      case 'text':
        return {
          data: { type: 'text', text: content.text },
          mediaType: undefined,
        };
    }
  }

  if (content instanceof URL) {
    return convertUrlToFilePartData(content);
  }

  if (typeof content === 'string') {
    try {
      return convertUrlToFilePartData(new URL(content));
    } catch {
      return convertInlineDataToFilePartData(content);
    }
  }

  if (isProviderReference(content)) {
    return {
      data: { type: 'reference', reference: content as ProviderReference },
      mediaType: undefined,
    };
  }

  return convertInlineDataToFilePartData(content as DataContent);
}
