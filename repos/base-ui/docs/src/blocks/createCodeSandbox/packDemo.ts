import { DemoFile } from 'docs/src/blocks/Demo';
import flattenRelativeImports from './flattenRelativeImports';

const SCRIPT_EXTENSIONS = ['js', 'ts', 'jsx', 'tsx'];

/**
 * Packs a demo into a format that can be used to create a CodeSandbox or StackBlitz project.
 * Also flattens the local dependencies so they are all in the same directory.
 *
 * WARNING: To simplify processing, each file name must be unique
 * (i.e., you can't have foo.ts and bar/foo.ts in the same demo)
 *
 * @param demoFiles Files that make a demo
 */
export function packDemo(demoFiles: DemoFile[]) {
  const processedFiles: Record<string, string> = {};
  const externalImports: Set<string> = new Set<string>();

  demoFiles.forEach((file, index) => {
    const fileExtension = file.name.split('.').pop() ?? '';
    let newContent = file.content;

    if (SCRIPT_EXTENSIONS.includes(fileExtension)) {
      const relativeImports: Set<string> = new Set<string>();
      const imports = extractImports(file.content);
      imports.forEach((importPath) => {
        if (importPath.startsWith('.')) {
          relativeImports.add(importPath);
        } else {
          externalImports.add(getPackageName(importPath));
        }
      });

      newContent = flattenRelativeImports(file.content, [...relativeImports]);
    }

    // the entry point is renamed to App.{ext}
    const newFileName = index === 0 ? `App.${fileExtension}` : file.name;
    processedFiles[newFileName] = newContent;
  });

  return {
    processedFiles,
    externalImports: [...externalImports],
  };
}

function extractImports(code: string) {
  return [...code.matchAll(/import\s+(?:[^'"]*?\s+from\s+)?['"]([^"'\n]*?)['"]/gm)].map(
    (match) => match[1],
  );
}

function getPackageName(importPath: string) {
  if (importPath.startsWith('@')) {
    return importPath.split('/').slice(0, 2).join('/');
  }

  return importPath.split('/')[0];
}
