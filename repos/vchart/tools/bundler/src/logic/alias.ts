import { Transform, TransformCallback } from 'stream';
import File from 'vinyl';
import path from 'path';

type Options = {
  cwd: string;
  paths: Record<string, string[]>;
  // baseUrl: string;
};

export interface FileData {
  path: string;
  index: number;
  import: string;
}

const COMMENTED_PATTERN = /(\/\*(?:(?!\*\/).|[\n\r])*\*\/)|(\/\/[^\n\r]*(?:[\n\r]+|$))/;
const IMPORT_PATTERNS = [
  /from (["'])(.*?)\1/g,
  /import\((["'])(.*?)\1\)/g,
  /require\((["'])(.*?)\1\)/g,
  /import\s+(["'])(.*?)\1/g
];
const NODE_MODULES_PATH = /(^|[/\\])node_modules([/\\]|$)/;

function parseImports(file: ReadonlyArray<string>, dir: string): FileData[] {
  return file.flatMap((line, index) => findImports(line).map(i => ({ path: dir, index, import: i })));
}

function findImports(line: string): string[] {
  line = line.replace(COMMENTED_PATTERN, '');

  return IMPORT_PATTERNS.flatMap(pattern => [...line.matchAll(pattern)].map(match => match[2]!));
}

function resolveImports(file: ReadonlyArray<string>, imports: FileData[], options: Options): string[] {
  const { paths, cwd } = options;

  const aliases: { [key: string]: string[] | undefined } = {};
  for (const alias in paths) {
    /* istanbul ignore else  */
    if (paths.hasOwnProperty(alias)) {
      let resolved = alias;
      if (alias.endsWith('/*')) {
        resolved = alias.replace('/*', '/');
      }

      aliases[resolved] = paths[alias];
    }
  }

  const lines: string[] = [...file];
  for (const imported of imports) {
    const line = file[imported.index]!;

    let resolved = '';
    for (const alias in aliases) {
      /* istanbul ignore else  */
      if (aliases.hasOwnProperty(alias) && imported.import.startsWith(alias)) {
        const choices: string[] | undefined = aliases[alias];

        if (choices !== undefined) {
          resolved = choices[0]!;
          if (NODE_MODULES_PATH.test(resolved)) {
            resolved = '';
            break;
          }
          if (resolved.endsWith('/*')) {
            resolved = resolved.replace('/*', '/');
          }

          resolved = imported.import.replace(alias, resolved);

          break;
        }
      }
    }

    if (resolved.length < 1) {
      continue;
    }

    const current = path.relative(cwd, path.dirname(imported.path));
    const target = path.relative(current, resolved);

    lines[imported.index] = line.replace(imported.import, `./${target}`);
  }

  return lines;
}

export function alias(options: Options) {
  return new Transform({
    objectMode: true,
    transform: (file: File, _encoding: BufferEncoding, callback: TransformCallback) => {
      /* istanbul ignore if */
      if (file.isStream()) {
        return callback(new Error('Streaming is not supported.'));
      }

      if (file.isNull() || !file.contents) {
        return callback(undefined, file);
      }

      if (!file.path) {
        return callback(new Error('Received file with no path. Files must have path to be resolved.'));
      }

      const lines = file.contents.toString().split('\n');
      const imports = parseImports(lines, file.path);

      if (imports.length === 0) {
        return callback(undefined, file);
      }

      const resolved = resolveImports(lines, imports, options);

      file.contents = Buffer.from(resolved.join('\n'));

      callback(undefined, file);
    }
  });
}
