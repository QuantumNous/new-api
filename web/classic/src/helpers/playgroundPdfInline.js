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
  buildInlineFileContentParts,
  buildInlineFileTextPart,
  formatInlineFileText,
  normalizeExtractedFileText,
} from './playgroundFileInline';

export const MAX_EXTRACTED_PDF_TEXT_LENGTH = MAX_EXTRACTED_FILE_TEXT_LENGTH;
export const normalizeExtractedPdfText = normalizeExtractedFileText;
export const formatInlinePdfText = formatInlineFileText;
export const buildPdfInlineTextPart = buildInlineFileTextPart;

export const buildPdfInlineContentParts = ({ prompt, pdfTexts }) =>
  buildInlineFileContentParts({
    prompt,
    files: pdfTexts,
  });
