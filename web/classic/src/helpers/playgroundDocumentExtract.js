/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import {
  MAX_EXTRACTED_FILE_TEXT_LENGTH,
  normalizeExtractedFileText,
} from './playgroundFileInline.js';

let mammothPromise;
let readExcelFilePromise;

const loadMammoth = async () => {
  if (!mammothPromise) {
    mammothPromise = import('mammoth').then((module) => module.default || module);
  }

  return mammothPromise;
};

const loadReadExcelFile = async () => {
  if (!readExcelFilePromise) {
    readExcelFilePromise = import('read-excel-file/browser').then(
      (module) => module.default,
    );
  }

  return readExcelFilePromise;
};

const formatSpreadsheetCellValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
};

const formatCsvCell = (value) => {
  const text = formatSpreadsheetCellValue(value);

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

const rowHasValue = (row) =>
  Array.isArray(row) &&
  row.some((value) => formatSpreadsheetCellValue(value).trim() !== '');

const rowsToCsv = (rows = []) =>
  rows
    .filter(rowHasValue)
    .map((row) => row.map(formatCsvCell).join(','))
    .join('\n')
    .trim();

export const extractDocxText = async (file, options = {}) => {
  const { maxChars = MAX_EXTRACTED_FILE_TEXT_LENGTH } = options;
  const mammoth = await loadMammoth();
  const result = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });

  return {
    text: normalizeExtractedFileText(result?.value, { maxChars }),
    warnings: result?.messages || [],
  };
};

export const extractXlsxText = async (file, options = {}) => {
  const { maxChars = MAX_EXTRACTED_FILE_TEXT_LENGTH } = options;
  const readExcelFile = await loadReadExcelFile();
  const sheets = await readExcelFile(file);
  const sheetTexts = [];
  let textLength = 0;
  let truncated = false;

  for (const sheet of sheets || []) {
    const sheetName = sheet?.sheet || 'Sheet';
    const csv = rowsToCsv(sheet?.data || []);

    if (!csv) {
      continue;
    }

    const nextText = `[Sheet: ${sheetName}]\n${csv}`;
    const separatorLength = sheetTexts.length > 0 ? 2 : 0;
    const nextLength = separatorLength + nextText.length;
    const remaining = maxChars - textLength;

    if (nextLength > remaining) {
      if (remaining > separatorLength) {
        const prefix = sheetTexts.length > 0 ? '\n\n' : '';
        sheetTexts.push(
          `${prefix}${nextText.slice(0, remaining - separatorLength)}`,
        );
      }
      truncated = true;
      break;
    }

    sheetTexts.push(`${sheetTexts.length > 0 ? '\n\n' : ''}${nextText}`);
    textLength += nextLength;
  }

  return {
    text: normalizeExtractedFileText(sheetTexts.join(''), { maxChars }),
    sheetCount: sheets?.length || 0,
    truncated,
  };
};

export const extractPlainTextFile = async (file, options = {}) => {
  const { maxChars = MAX_EXTRACTED_FILE_TEXT_LENGTH } = options;

  return {
    text: normalizeExtractedFileText(await file.text(), { maxChars }),
  };
};

export const extractJsonText = async (file, options = {}) => {
  const { maxChars = MAX_EXTRACTED_FILE_TEXT_LENGTH } = options;
  const rawText = await file.text();

  try {
    return {
      text: normalizeExtractedFileText(
        JSON.stringify(JSON.parse(rawText), null, 2),
        {
          maxChars,
        },
      ),
    };
  } catch {
    return {
      text: normalizeExtractedFileText(rawText, { maxChars }),
    };
  }
};
