import path from 'node:path';
import { NODE_MODULES_REGEX } from '../constants';
import { toRelativePath } from '../helpers/path';
import { ansiHTML } from './ansiHTML';
import { escapeHtml } from './helper';

export function formatDisplayPath(filePath: string, isAbsolute: boolean, root?: string): string {
  // Format node_modules paths
  // Input: /project/node_modules/.pnpm/foo@1.0.0/node_modules/foo/dist/index.js:0:0
  // Output: node_modules/foo/dist/index.js:0:0
  if (NODE_MODULES_REGEX.test(filePath)) {
    for (const needle of ['/node_modules/', '\\node_modules\\']) {
      const index = filePath.lastIndexOf(needle);
      if (index !== -1) {
        return filePath.slice(index + 1);
      }
    }
  }

  if (root && isAbsolute) {
    return toRelativePath(root, filePath);
  }
  return filePath;
}

export function convertLinksInHtml(text: string, root?: string): string {
  /**
   * Match absolute or relative paths with line and column
   * @example
   * 1. ./src/index.js:1:1
   * 2. .\src\index.js:1:1
   * 3. src/index.js:1:1
   * 4. ../Button.js:1:1
   * 5. C:\Users\username\project\src\index.js:1:1
   * 6. /home/user/project/src/index.js:1:1
   * 7. file:///home/user/project/src/index.js:1:1
   * 8. file:///C:/Users/username/project/src/index.js:1:1
   */
  const PATH_RE =
    /(?:\.\.?[/\\]|(file:\/\/\/)?[a-zA-Z]:\\|(file:\/\/)?\/|[A-Za-z0-9._-]+[/\\])[^\s:]*:\d+:\d+/g;

  const URL_RE = /(https?:\/\/(?:[\w-]+\.)+[a-z0-9](?:[\w-.~:/?#[\]@!$&'*+,;=])*)/gi;

  const NODE_INTERNAL_RE = /node:internal[/\\]/;
  const RSPACK_RUNTIME_RE = /webpack\/runtime\//;
  const FILE_URI_WINDOWS_RE = /^file:\/\/\/([A-Za-z]:)/;
  const FILE_URI_UNIX_RE = /^file:\/\//;

  const stripFileUri = (file: string) => {
    if (!file.startsWith('file://')) {
      return file;
    }

    // Windows: file:///C:/path → C:/path
    const windows = file.replace(FILE_URI_WINDOWS_RE, '$1');
    if (windows !== file) {
      return windows;
    }

    // Unix: file:///usr → /usr
    return file.replace(FILE_URI_UNIX_RE, '');
  };

  const lines = text.split('\n');
  const replacedLines = lines.map((line) => {
    // Skip processing node internal paths and Rspack runtime modules
    if (NODE_INTERNAL_RE.test(line) || RSPACK_RUNTIME_RE.test(line)) {
      return line;
    }

    let replacedLine = line.replace(PATH_RE, (file) => {
      file = stripFileUri(file);

      // If the file contains `</span>`, it means the file path contains ANSI codes.
      // We need to move the `</span>` to the end of the file path.
      const hasClosingSpan = file.includes('</span>') && !file.includes('<span');
      const filePath = hasClosingSpan ? file.replace('</span>', '') : file;
      const suffix = hasClosingSpan ? '</span>' : '';
      const isAbsolute = path.isAbsolute(filePath);
      const absolutePath = root && !isAbsolute ? path.join(root, filePath) : filePath;
      const displayPath = formatDisplayPath(filePath, isAbsolute, root);

      return `<a class="file-link" data-file="${absolutePath}">${displayPath}</a>${suffix}`;
    });

    replacedLine = replacedLine.replace(URL_RE, (url) => {
      return `<a class="url-link" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });

    return replacedLine;
  });

  return replacedLines.join('\n');
}

export function renderErrorToHtml(error: string, root?: string): string {
  return convertLinksInHtml(ansiHTML(escapeHtml(error)), root);
}
