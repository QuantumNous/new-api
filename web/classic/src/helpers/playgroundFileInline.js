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

export const MAX_EXTRACTED_FILE_TEXT_LENGTH = 120000;

export const normalizeExtractedFileText = (text, options = {}) => {
  const { maxChars = MAX_EXTRACTED_FILE_TEXT_LENGTH } = options;
  const normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .trim();

  if (!normalized) {
    return '';
  }

  if (!Number.isFinite(maxChars) || maxChars <= 0) {
    return normalized;
  }

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars)}\n\n[Truncated]`;
};

export const formatInlineFileText = ({ filename, text }) => {
  const normalizedText = normalizeExtractedFileText(text);
  return `File: ${filename || 'unnamed'}\n\n${normalizedText || '[No extractable text found]'}`;
};

export const buildInlineFileTextPart = ({ filename, text }) => ({
  type: 'text',
  text: formatInlineFileText({ filename, text }),
});

export const buildInlineFileContentParts = ({ prompt, files }) => {
  const content = [];
  const trimmedPrompt = String(prompt || '').trim();
  const normalizedFiles = Array.isArray(files) ? files : [];

  if (trimmedPrompt) {
    content.push({
      type: 'text',
      text: trimmedPrompt,
    });
  }

  normalizedFiles.forEach((file) => {
    content.push(buildInlineFileTextPart(file));
  });

  return content;
};
