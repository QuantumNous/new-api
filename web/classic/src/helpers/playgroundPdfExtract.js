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

import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  MAX_EXTRACTED_FILE_TEXT_LENGTH,
  normalizeExtractedFileText,
} from './playgroundFileInline';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const normalizeTextItems = (items = []) =>
  items
    .map((item) => (typeof item?.str === 'string' ? item.str : ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

export const extractPdfText = async (file, options = {}) => {
  const { maxChars = MAX_EXTRACTED_FILE_TEXT_LENGTH } = options;
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pageTexts = [];
  let textLength = 0;
  let truncated = false;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = normalizeTextItems(textContent.items);
      page.cleanup?.();

      if (!pageText) {
        continue;
      }

      const nextText = `[Page ${pageNumber}]\n${pageText}`;
      const separatorLength = pageTexts.length > 0 ? 2 : 0;
      const nextLength = separatorLength + nextText.length;
      const remaining = maxChars - textLength;

      if (nextLength > remaining) {
        if (remaining > separatorLength) {
          const prefix = pageTexts.length > 0 ? '\n\n' : '';
          pageTexts.push(
            `${prefix}${nextText.slice(0, remaining - separatorLength)}`,
          );
        }
        truncated = true;
        break;
      }

      pageTexts.push(`${pageTexts.length > 0 ? '\n\n' : ''}${nextText}`);
      textLength += nextLength;
    }

    const text = normalizeExtractedFileText(pageTexts.join(''), { maxChars });

    return {
      text,
      pageCount: pdf.numPages,
      truncated,
    };
  } finally {
    if (typeof pdf.destroy === 'function') {
      await pdf.destroy();
    } else if (typeof loadingTask.destroy === 'function') {
      await loadingTask.destroy();
    }
  }
};
