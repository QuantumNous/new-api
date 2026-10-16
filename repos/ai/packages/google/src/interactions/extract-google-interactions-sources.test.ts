import { describe, expect, it } from 'vitest';
import {
  annotationToSource,
  annotationsToSources,
  builtinToolResultToSources,
} from './extract-google-interactions-sources';
import type { GoogleInteractionsBuiltinToolResultContent } from './google-interactions-prompt';

let nextId = 0;
function generateId(): string {
  return `id-${++nextId}`;
}

describe('annotationToSource', () => {
  it('maps a url_citation annotation to a url source', () => {
    nextId = 0;
    const source = annotationToSource({
      annotation: {
        type: 'url_citation',
        url: 'https://example.com/article',
        title: 'Example Article',
      },
      generateId,
    });
    expect(source).toEqual({
      type: 'source',
      sourceType: 'url',
      id: 'id-1',
      url: 'https://example.com/article',
      title: 'Example Article',
    });
  });

  it('returns undefined for url_citation without a url', () => {
    const source = annotationToSource({
      annotation: { type: 'url_citation' },
      generateId,
    });
    expect(source).toBeUndefined();
  });

  it('maps a file_citation with http document_uri to a url source', () => {
    nextId = 0;
    const source = annotationToSource({
      annotation: {
        type: 'file_citation',
        document_uri: 'https://files.example.com/foo.pdf',
        file_name: 'foo.pdf',
      },
      generateId,
    });
    expect(source).toEqual({
      type: 'source',
      sourceType: 'url',
      id: 'id-1',
      url: 'https://files.example.com/foo.pdf',
      title: 'foo.pdf',
    });
  });

  it('maps a file_citation with non-http uri to a document source', () => {
    nextId = 0;
    const source = annotationToSource({
      annotation: {
        type: 'file_citation',
        document_uri: 'gs://bucket/path/report.pdf',
        file_name: 'report.pdf',
      },
      generateId,
    });
    expect(source).toEqual({
      type: 'source',
      sourceType: 'document',
      id: 'id-1',
      mediaType: 'application/pdf',
      title: 'report.pdf',
      filename: 'report.pdf',
    });
  });

  it('maps a place_citation to a url source when url is present', () => {
    nextId = 0;
    const source = annotationToSource({
      annotation: {
        type: 'place_citation',
        url: 'https://maps.google.com/?q=foo',
        name: 'Foo Place',
      },
      generateId,
    });
    expect(source).toEqual({
      type: 'source',
      sourceType: 'url',
      id: 'id-1',
      url: 'https://maps.google.com/?q=foo',
      title: 'Foo Place',
    });
  });

  it('returns undefined for unknown annotation types', () => {
    const source = annotationToSource({
      annotation: { type: 'unknown_kind' },
      generateId,
    });
    expect(source).toBeUndefined();
  });
});

describe('annotationsToSources', () => {
  it('returns [] for null/undefined annotations', () => {
    expect(annotationsToSources({ annotations: null, generateId })).toEqual([]);
    expect(
      annotationsToSources({ annotations: undefined, generateId }),
    ).toEqual([]);
  });

  it('de-duplicates url citations across multiple annotations', () => {
    nextId = 0;
    const sources = annotationsToSources({
      annotations: [
        {
          type: 'url_citation',
          url: 'https://a.example.com',
          title: 'A',
        },
        {
          type: 'url_citation',
          url: 'https://a.example.com',
          title: 'A',
        },
        {
          type: 'url_citation',
          url: 'https://b.example.com',
          title: 'B',
        },
      ],
      generateId,
    });
    expect(sources.map(s => (s.sourceType === 'url' ? s.url : null))).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });
});

describe('builtinToolResultToSources', () => {
  it('maps url_context_result entries with status:success to url sources', () => {
    nextId = 0;
    const block: GoogleInteractionsBuiltinToolResultContent = {
      type: 'url_context_result',
      call_id: 'c1',
      result: [
        { url: 'https://a.com', status: 'success' },
        { url: 'https://b.com', status: 'error' },
        { url: 'https://c.com' },
      ],
    };
    const sources = builtinToolResultToSources({ block, generateId });
    expect(sources.map(s => (s.sourceType === 'url' ? s.url : null))).toEqual([
      'https://a.com',
      'https://c.com',
    ]);
  });

  it('maps google_search_result entries with url to url sources', () => {
    nextId = 0;
    const block: GoogleInteractionsBuiltinToolResultContent = {
      type: 'google_search_result',
      call_id: 'c1',
      result: [
        { url: 'https://news.example.com/1', title: 'Article 1' },
        { search_suggestions: '<html>...</html>' },
        { url: 'https://news.example.com/2' },
      ],
    };
    const sources = builtinToolResultToSources({ block, generateId });
    expect(sources).toEqual([
      {
        type: 'source',
        sourceType: 'url',
        id: 'id-1',
        url: 'https://news.example.com/1',
        title: 'Article 1',
      },
      {
        type: 'source',
        sourceType: 'url',
        id: 'id-2',
        url: 'https://news.example.com/2',
      },
    ]);
  });

  it('maps google_maps_result places with url to url sources', () => {
    nextId = 0;
    const block: GoogleInteractionsBuiltinToolResultContent = {
      type: 'google_maps_result',
      call_id: 'c1',
      result: [
        {
          places: [
            { name: 'Foo Cafe', url: 'https://maps.google.com/?q=foo' },
            { name: 'Bar Bar' }, // no URL -> skipped
          ],
        },
      ],
    };
    const sources = builtinToolResultToSources({ block, generateId });
    expect(sources).toEqual([
      {
        type: 'source',
        sourceType: 'url',
        id: 'id-1',
        url: 'https://maps.google.com/?q=foo',
        title: 'Foo Cafe',
      },
    ]);
  });

  it('maps file_search_result entries to document sources', () => {
    nextId = 0;
    const block = {
      type: 'file_search_result',
      call_id: 'c1',
      result: [
        { file_name: 'report.pdf', source: 'fileSearchStores/x/report.pdf' },
        { document_uri: 'https://storage.example.com/file.txt' },
      ],
    } as unknown as GoogleInteractionsBuiltinToolResultContent;
    const sources = builtinToolResultToSources({ block, generateId });
    expect(sources).toEqual([
      {
        type: 'source',
        sourceType: 'document',
        id: 'id-1',
        mediaType: 'application/pdf',
        title: 'report.pdf',
        filename: 'report.pdf',
      },
      {
        type: 'source',
        sourceType: 'url',
        id: 'id-2',
        url: 'https://storage.example.com/file.txt',
      },
    ]);
  });

  it('returns [] for code_execution_result (no source-able output)', () => {
    nextId = 0;
    const block = {
      type: 'code_execution_result',
      call_id: 'c1',
      result: 'hello',
    } as GoogleInteractionsBuiltinToolResultContent;
    expect(builtinToolResultToSources({ block, generateId })).toEqual([]);
  });
});
