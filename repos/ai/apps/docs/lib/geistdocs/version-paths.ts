import { v6Source, v7Source } from './source';

const v6Paths = new Set(v6Source.source.getPages('en').map(page => page.url));
const v7Paths = new Set(
  v7Source.source.getPages('en').map(page => page.url.replace(/^\/v7/, '')),
);

export const missingVersionPaths = {
  v6: [...v7Paths].filter(path => !v6Paths.has(path)),
  v7: [...v6Paths].filter(path => !v7Paths.has(path)),
};
