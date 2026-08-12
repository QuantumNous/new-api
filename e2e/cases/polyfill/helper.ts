import { findFile } from '@rstackjs/test-utils';

export const getPolyfillContent = (files: Record<string, string>) => {
  let polyfillFileName: string | undefined;

  try {
    polyfillFileName = findFile(files, 'lib-polyfill.js.map');
  } catch {
    polyfillFileName = undefined;
  }

  const indexFileName = findFile(files, 'index.js.map');

  return files[polyfillFileName ?? indexFileName];
};
