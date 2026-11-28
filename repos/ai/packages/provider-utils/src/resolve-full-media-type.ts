import {
  UnsupportedFunctionalityError,
  type LanguageModelV4FilePart,
} from '@ai-sdk/provider';
import {
  detectMediaType,
  getTopLevelMediaType,
  isFullMediaType,
} from './detect-media-type';

/**
 * Resolves a file part's media type to a full `type/subtype` form required by
 * providers whose API demands the full IANA media type.
 *
 * - If `part.mediaType` is already a full media type (e.g. `image/png`), it is
 *   returned as-is.
 * - Otherwise, when inline bytes are available (`part.data.type === 'data'`),
 *   the subtype is sniffed from the bytes using the signature table that
 *   corresponds to the top-level segment.
 * - When neither applies (e.g. top-level-only with a URL source, or bytes that
 *   cannot be detected), an `UnsupportedFunctionalityError` is thrown.
 */
export function resolveFullMediaType({
  part,
}: {
  part: LanguageModelV4FilePart;
}): string {
  if (isFullMediaType(part.mediaType)) {
    return part.mediaType;
  }

  if (part.data.type === 'data') {
    const detected = detectMediaType({
      data: part.data.data,
      topLevelType: getTopLevelMediaType(part.mediaType),
    });
    if (detected) {
      return detected;
    }

    throw new UnsupportedFunctionalityError({
      functionality: `file of media type "${part.mediaType}" must specify subtype since it could not be auto-detected`,
    });
  }

  throw new UnsupportedFunctionalityError({
    functionality: `file of media type "${part.mediaType}" must specify subtype since it is not passed as inline bytes`,
  });
}
