import type {
  DataContent,
  ReasoningFilePart,
  ReasoningPart,
} from '@ai-sdk/provider-utils';
import type { ProviderMetadata } from '../types/provider-metadata';
import { DefaultGeneratedFile, type GeneratedFile } from './generated-file';

function unwrapReasoningFileData(
  data: ReasoningFilePart['data'],
): DataContent | URL {
  if (typeof data === 'object' && data !== null && 'type' in data) {
    return data.type === 'data' ? data.data : data.url;
  }
  return data;
}

/**
 * Reasoning output of a text generation. It contains a reasoning.
 */
export interface ReasoningOutput {
  type: 'reasoning';

  /**
   * The reasoning text.
   */
  text: string;

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: ProviderMetadata;
}

/**
 * Reasoning file output of a text generation.
 * It contains a file generated as part of reasoning.
 */
export interface ReasoningFileOutput {
  type: 'reasoning-file';

  /**
   * The generated file.
   */
  file: GeneratedFile;

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerMetadata?: ProviderMetadata;
}

export function convertFromReasoningOutputs(
  parts: Array<ReasoningOutput | ReasoningFileOutput>,
): Array<ReasoningPart | ReasoningFilePart> {
  return parts.map(part => {
    if (part.type === 'reasoning') {
      return {
        type: 'reasoning' as const,
        text: part.text,
        ...(part.providerMetadata != null
          ? { providerOptions: part.providerMetadata }
          : {}),
      };
    }

    return {
      type: 'reasoning-file' as const,
      data: part.file.base64,
      mediaType: part.file.mediaType,
      ...(part.providerMetadata != null
        ? { providerOptions: part.providerMetadata }
        : {}),
    };
  });
}

export function convertToReasoningOutputs(
  parts: Array<ReasoningPart | ReasoningFilePart>,
): Array<ReasoningOutput | ReasoningFileOutput> {
  return parts.map(part => {
    if (part.type === 'reasoning') {
      return {
        type: 'reasoning' as const,
        text: part.text,
        ...(part.providerOptions != null
          ? { providerMetadata: part.providerOptions as ProviderMetadata }
          : {}),
      };
    }

    const rawData = unwrapReasoningFileData(part.data);

    const fileData: string | Uint8Array =
      rawData instanceof ArrayBuffer
        ? new Uint8Array(rawData)
        : rawData instanceof URL
          ? rawData.toString()
          : (rawData as string | Uint8Array);

    return {
      type: 'reasoning-file' as const,
      file: new DefaultGeneratedFile({
        data: fileData,
        mediaType: part.mediaType,
      }),
      ...(part.providerOptions != null
        ? { providerMetadata: part.providerOptions as ProviderMetadata }
        : {}),
    };
  });
}
