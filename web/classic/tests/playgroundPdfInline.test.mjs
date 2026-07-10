import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInlineFileContentParts,
  buildInlineFileTextPart,
  formatInlineFileText,
  normalizeExtractedFileText,
} from '../src/helpers/playgroundFileInline.js';
import {
  extractJsonText,
  extractPlainTextFile,
} from '../src/helpers/playgroundDocumentExtract.js';

test('buildInlineFileTextPart builds a chat-compatible file text part', () => {
  assert.deepEqual(
    buildInlineFileTextPart({
      filename: 'report.pdf',
      text: 'Alpha Beta',
    }),
    {
      type: 'text',
      text: 'File: report.pdf\n\nAlpha Beta',
    },
  );
});

test('buildInlineFileContentParts builds prompt plus one text part per file', () => {
  const content = buildInlineFileContentParts({
    prompt: 'Summarize these files',
    files: [
      {
        filename: 'a.docx',
        text: 'A body',
      },
      {
        filename: 'b.xlsx',
        text: 'B body',
      },
    ],
  });

  assert.deepEqual(content, [
    {
      type: 'text',
      text: 'Summarize these files',
    },
    {
      type: 'text',
      text: 'File: a.docx\n\nA body',
    },
    {
      type: 'text',
      text: 'File: b.xlsx\n\nB body',
    },
  ]);
});

test('buildInlineFileContentParts trims prompt and allows file-only requests', () => {
  const content = buildInlineFileContentParts({
    prompt: '   ',
    files: [
      {
        filename: 'only.pdf',
        text: 'Only body',
      },
    ],
  });

  assert.deepEqual(content, [
    {
      type: 'text',
      text: 'File: only.pdf\n\nOnly body',
    },
  ]);
});

test('formatInlineFileText hides empty extraction behind a stable marker', () => {
  assert.equal(
    formatInlineFileText({
      filename: 'scan.pdf',
      text: '',
    }),
    'File: scan.pdf\n\n[No extractable text found]',
  );
});

test('normalizeExtractedFileText normalizes nulls and truncates long content', () => {
  assert.equal(
    normalizeExtractedFileText(' A\u0000\r\nB ', {
      maxChars: 100,
    }),
    'A\nB',
  );

  assert.equal(
    normalizeExtractedFileText('1234567890', {
      maxChars: 4,
    }),
    '1234\n\n[Truncated]',
  );
});

test('extractPlainTextFile reads TXT content as inline text', async () => {
  const result = await extractPlainTextFile(new Blob(['hello txt']));

  assert.equal(result.text, 'hello txt');
});

test('extractJsonText formats valid JSON content', async () => {
  const result = await extractJsonText(new Blob(['{"b":2}']));

  assert.equal(result.text, '{\n  "b": 2\n}');
});
