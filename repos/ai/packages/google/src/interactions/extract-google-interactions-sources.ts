import type { LanguageModelV4Source } from '@ai-sdk/provider';
import type {
  GoogleInteractionsAnnotation,
  GoogleInteractionsBuiltinToolResultContent,
  GoogleInteractionsFileCitation,
  GoogleInteractionsGoogleMapsResultContent,
  GoogleInteractionsGoogleSearchResultContent,
  GoogleInteractionsPlaceCitation,
  GoogleInteractionsURLCitation,
  GoogleInteractionsURLContextResultContent,
} from './google-interactions-prompt';

const KNOWN_DOC_EXTENSIONS: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function inferDocMediaType(uriOrName: string): string {
  const lower = uriOrName.toLowerCase();
  for (const [ext, media] of Object.entries(KNOWN_DOC_EXTENSIONS)) {
    if (lower.endsWith(`.${ext}`)) return media;
  }
  return 'application/octet-stream';
}

function basename(uriOrName: string): string | undefined {
  const parts = uriOrName.split('/');
  const last = parts[parts.length - 1];
  return last && last.length > 0 ? last : undefined;
}

/**
 * Maps a single text-block annotation (`url_citation` / `file_citation` /
 * `place_citation`) onto a `LanguageModelV4Source`. Returns `undefined` when
 * the annotation lacks the minimum payload to form a source (e.g. a URL
 * citation without a `url`).
 */
export function annotationToSource({
  annotation,
  generateId,
}: {
  annotation: GoogleInteractionsAnnotation | { type: string };
  generateId: () => string;
}): LanguageModelV4Source | undefined {
  switch (annotation.type) {
    case 'url_citation': {
      const urlCitation = annotation as GoogleInteractionsURLCitation;
      if (urlCitation.url == null || urlCitation.url.length === 0) {
        return undefined;
      }
      return {
        type: 'source',
        sourceType: 'url',
        id: generateId(),
        url: urlCitation.url,
        ...(urlCitation.title != null ? { title: urlCitation.title } : {}),
      };
    }
    case 'file_citation': {
      const fileCitation = annotation as GoogleInteractionsFileCitation;
      const uri =
        fileCitation.url ?? fileCitation.document_uri ?? fileCitation.file_name;
      if (uri == null || uri.length === 0) return undefined;
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        return {
          type: 'source',
          sourceType: 'url',
          id: generateId(),
          url: uri,
          ...(fileCitation.file_name != null
            ? { title: fileCitation.file_name }
            : {}),
        };
      }
      const filename = fileCitation.file_name ?? basename(uri);
      const mediaType = inferDocMediaType(uri);
      return {
        type: 'source',
        sourceType: 'document',
        id: generateId(),
        mediaType,
        title: fileCitation.file_name ?? filename ?? uri,
        ...(filename != null ? { filename } : {}),
      };
    }
    case 'place_citation': {
      const placeCitation = annotation as GoogleInteractionsPlaceCitation;
      if (placeCitation.url == null || placeCitation.url.length === 0) {
        return undefined;
      }
      return {
        type: 'source',
        sourceType: 'url',
        id: generateId(),
        url: placeCitation.url,
        ...(placeCitation.name != null ? { title: placeCitation.name } : {}),
      };
    }
    default:
      return undefined;
  }
}

/**
 * Maps a built-in tool *result* content block to zero or more
 * `LanguageModelV4Source` parts. The Interactions API exposes grounding
 * sources both inline (via `text_annotation` deltas) and via tool-result
 * content blocks; the latter is what this function consumes.
 *
 * Supported result kinds:
 * - `url_context_result`   -> URL sources for each fetched URL with `status: 'success'`
 * - `google_search_result` -> URL sources (when `url` is present), search-suggestion
 *                              entries are skipped (they are HTML widgets, not citations)
 * - `google_maps_result`   -> URL sources for each place with a `url`
 * - `file_search_result`   -> document sources (best-effort -- `result[]` is loosely typed)
 */
export function builtinToolResultToSources({
  block,
  generateId,
}: {
  block: GoogleInteractionsBuiltinToolResultContent;
  generateId: () => string;
}): Array<LanguageModelV4Source> {
  const sources: Array<LanguageModelV4Source> = [];

  switch (block.type) {
    case 'url_context_result': {
      const result =
        (block as GoogleInteractionsURLContextResultContent).result ?? [];
      for (const entry of result) {
        if (entry?.url == null || entry.url.length === 0) continue;
        if (entry.status != null && entry.status !== 'success') continue;
        sources.push({
          type: 'source',
          sourceType: 'url',
          id: generateId(),
          url: entry.url,
        });
      }
      break;
    }
    case 'google_search_result': {
      const result =
        (block as GoogleInteractionsGoogleSearchResultContent).result ?? [];
      for (const entry of result) {
        const url = entry?.url;
        if (url == null || url.length === 0) continue;
        sources.push({
          type: 'source',
          sourceType: 'url',
          id: generateId(),
          url,
          ...(entry.title != null ? { title: entry.title } : {}),
        });
      }
      break;
    }
    case 'google_maps_result': {
      const result =
        (block as GoogleInteractionsGoogleMapsResultContent).result ?? [];
      for (const entry of result) {
        for (const place of entry.places ?? []) {
          if (place.url == null || place.url.length === 0) continue;
          sources.push({
            type: 'source',
            sourceType: 'url',
            id: generateId(),
            url: place.url,
            ...(place.name != null ? { title: place.name } : {}),
          });
        }
      }
      break;
    }
    case 'file_search_result': {
      const result = (block as { result?: Array<unknown> }).result ?? [];
      for (const raw of result) {
        if (raw == null || typeof raw !== 'object') continue;
        const entry = raw as {
          file_name?: string;
          document_uri?: string;
          url?: string;
          title?: string;
        };
        const uri = entry.url ?? entry.document_uri ?? entry.file_name;
        if (uri == null || uri.length === 0) continue;
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          sources.push({
            type: 'source',
            sourceType: 'url',
            id: generateId(),
            url: uri,
            ...(entry.title != null ? { title: entry.title } : {}),
          });
          continue;
        }
        const filename = entry.file_name ?? basename(uri);
        const mediaType = inferDocMediaType(uri);
        sources.push({
          type: 'source',
          sourceType: 'document',
          id: generateId(),
          mediaType,
          title: entry.title ?? entry.file_name ?? filename ?? uri,
          ...(filename != null ? { filename } : {}),
        });
      }
      break;
    }
    default:
      break;
  }

  return sources;
}

/**
 * Given a list of annotations attached to a single `text` content block,
 * returns the corresponding `LanguageModelV4Source` parts (de-duplicated by
 * URL/filename to avoid double-counting when the same citation reappears
 * across deltas).
 */
export function annotationsToSources({
  annotations,
  generateId,
}: {
  annotations:
    | Array<GoogleInteractionsAnnotation | { type: string }>
    | null
    | undefined;
  generateId: () => string;
}): Array<LanguageModelV4Source> {
  if (annotations == null) return [];
  const seen = new Set<string>();
  const sources: Array<LanguageModelV4Source> = [];
  for (const annotation of annotations) {
    const source = annotationToSource({ annotation, generateId });
    if (source == null) continue;
    const key =
      source.sourceType === 'url'
        ? `url:${source.url}`
        : `doc:${source.filename ?? source.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push(source);
  }
  return sources;
}
