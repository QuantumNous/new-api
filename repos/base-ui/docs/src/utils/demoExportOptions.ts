import { stringOrHastToString } from '@mui/internal-docs-infra/pipeline/hastUtils';
import type {
  HastRoot,
  VariantExtraFiles,
  VariantSource,
} from '@mui/internal-docs-infra/CodeHighlighter/types';
import { ExportConfig } from '@mui/internal-docs-infra/useDemo';

const defaultStylesLink = `<link rel="stylesheet" href="demo.css" />`;
const htmlHeadWithDefaultStyles: ExportConfig['headTemplate'] = () => defaultStylesLink;
const demoCss = `:root {
  color-scheme: light dark;
}

body {
  font-family: system-ui;
  margin: 0;

  /* iOS 26+ Safari: https://base-ui.com/react/overview/quick-start#ios-26-safari */
  position: relative;
}

#root {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  padding: 3rem;
  isolation: isolate;
}
`;

// Tailwind CSS Setup
const tailwindSetup = `
<!-- Check out the Tailwind CSS' installation guide for setting it up: https://tailwindcss.com/docs/installation/framework-guides -->
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>`;
const tailwindNote = `

<!-- Inject classes used so that Tailwind loaded from the CDN can pre-render them. -->
<!-- This is for the CodeSandbox example only. You don't need this in your app. -->
`;

function addClassNames(classNames: Set<string>, classes: string) {
  classes.split(/\s+/).forEach((className) => {
    if (className) {
      classNames.add(className);
    }
  });
}

type TemplateChunk = { type: 'text'; value: string } | { type: 'identifier'; value: string };

function isIdentifierStart(char: string | undefined) {
  return char !== undefined && /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char: string | undefined) {
  return char !== undefined && /[A-Za-z0-9_$]/.test(char);
}

function isHastRoot(source: VariantSource): source is HastRoot {
  return (
    typeof source === 'object' && source !== null && 'type' in source && source.type === 'root'
  );
}

function getTextContent(node: unknown): string {
  if (typeof node !== 'object' || node === null) {
    return '';
  }

  if ('type' in node && node.type === 'text' && 'value' in node && typeof node.value === 'string') {
    return node.value;
  }

  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child) => getTextContent(child)).join('');
  }

  return '';
}

function getSourceText(source: VariantSource): string {
  if (typeof source === 'string') {
    return source;
  }

  if (isHastRoot(source)) {
    return getTextContent(source);
  }

  return stringOrHastToString(source);
}

function hasTokenClass(node: unknown, tokenClass: string) {
  if (typeof node !== 'object' || node === null || !('properties' in node)) {
    return false;
  }

  const properties = node.properties as { className?: string | string[] };
  const className = properties.className;
  if (Array.isArray(className)) {
    return className.includes(tokenClass);
  }

  return className === tokenClass;
}

function getStringLiteralContent(node: unknown): string {
  if (
    typeof node !== 'object' ||
    node === null ||
    !('children' in node) ||
    !Array.isArray(node.children)
  ) {
    return '';
  }

  return node.children
    .filter(
      (child) => !(typeof child === 'object' && child !== null && hasTokenClass(child, 'pl-pds')),
    )
    .map((child) => getTextContent(child))
    .join('');
}

function collectLiteralClassNamesFromHast(node: unknown, classNames: Set<string>) {
  if (
    typeof node !== 'object' ||
    node === null ||
    !('children' in node) ||
    !Array.isArray(node.children)
  ) {
    return;
  }

  const { children } = node;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];

    if (
      typeof child === 'object' &&
      child !== null &&
      'type' in child &&
      child.type === 'element' &&
      'tagName' in child &&
      child.tagName === 'span' &&
      hasTokenClass(child, 'pl-e') &&
      getTextContent(child) === 'className'
    ) {
      for (
        let siblingIndex = index + 1;
        siblingIndex < children.length && siblingIndex <= index + 3;
        siblingIndex += 1
      ) {
        const sibling = children[siblingIndex];

        if (
          typeof sibling === 'object' &&
          sibling !== null &&
          'type' in sibling &&
          sibling.type === 'element' &&
          'tagName' in sibling &&
          sibling.tagName === 'span' &&
          hasTokenClass(sibling, 'pl-s')
        ) {
          addClassNames(classNames, getStringLiteralContent(sibling));
          break;
        }
      }
    }

    collectLiteralClassNamesFromHast(child, classNames);
  }
}

function decodeEscape(source: string, index: number) {
  return {
    value: source[index + 1] ?? '',
    end: index + 2,
  };
}

function readStringLiteral(source: string, start: number) {
  const quote = source[start];
  if (quote !== '"' && quote !== "'") {
    return null;
  }

  let index = start + 1;
  let value = '';

  while (index < source.length) {
    const char = source[index];

    if (char === '\\') {
      const escaped = decodeEscape(source, index);
      value += escaped.value;
      index = escaped.end;
      continue;
    }

    if (char === quote) {
      return { value, end: index + 1 };
    }

    value += char;
    index += 1;
  }

  return null;
}

function skipIgnored(source: string, start: number) {
  const char = source[start];

  if (char === '"' || char === "'") {
    return readStringLiteral(source, start)?.end ?? start + 1;
  }

  if (char === '`') {
    return readTemplateLiteral(source, start)?.end ?? start + 1;
  }

  if (char === '/' && source[start + 1] === '/') {
    let index = start + 2;
    while (index < source.length && source[index] !== '\n') {
      index += 1;
    }
    return index;
  }

  if (char === '/' && source[start + 1] === '*') {
    let index = start + 2;
    while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
      index += 1;
    }
    return index + 2;
  }

  return null;
}

function skipTrivia(source: string, start: number) {
  let index = start;

  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }

    if (source[index] === '/' && source[index + 1] === '/') {
      let skipped = index + 2;
      while (skipped < source.length && source[skipped] !== '\n') {
        skipped += 1;
      }
      index = skipped;
      continue;
    }

    if (source[index] === '/' && source[index + 1] === '*') {
      let skipped = index + 2;
      while (skipped < source.length && !(source[skipped] === '*' && source[skipped + 1] === '/')) {
        skipped += 1;
      }
      index = skipped + 2;
      continue;
    }

    break;
  }

  return index;
}

function readIdentifier(source: string, start: number) {
  if (!isIdentifierStart(source[start])) {
    return null;
  }

  let index = start + 1;
  while (isIdentifierPart(source[index])) {
    index += 1;
  }

  return { value: source.slice(start, index), end: index };
}

function findExpressionBoundary(source: string, start: number, terminators: Set<string>) {
  let index = start;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  while (index < source.length) {
    if (
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0 &&
      terminators.has(source[index])
    ) {
      return index;
    }

    const skipped = skipIgnored(source, index);
    if (skipped !== null) {
      index = skipped;
      continue;
    }

    if (source[index] === '(') {
      parenDepth += 1;
    } else if (source[index] === ')') {
      parenDepth = Math.max(parenDepth - 1, 0);
    } else if (source[index] === '[') {
      bracketDepth += 1;
    } else if (source[index] === ']') {
      bracketDepth = Math.max(bracketDepth - 1, 0);
    } else if (source[index] === '{') {
      braceDepth += 1;
    } else if (source[index] === '}') {
      braceDepth = Math.max(braceDepth - 1, 0);
    }

    index += 1;
  }

  return index;
}

function readTemplateLiteral(source: string, start: number) {
  if (source[start] !== '`') {
    return null;
  }

  let index = start + 1;
  let text = '';
  const chunks: TemplateChunk[] = [];

  while (index < source.length) {
    if (source[index] === '\\') {
      const escaped = decodeEscape(source, index);
      text += escaped.value;
      index = escaped.end;
      continue;
    }

    if (source[index] === '`') {
      if (text) {
        chunks.push({ type: 'text', value: text });
      }
      return { chunks, end: index + 1 };
    }

    if (source[index] === '$' && source[index + 1] === '{') {
      if (text) {
        chunks.push({ type: 'text', value: text });
        text = '';
      }

      const expressionStart = index + 2;
      const expressionEnd = findExpressionBoundary(source, expressionStart, new Set(['}']));
      const expression = source.slice(expressionStart, expressionEnd).trim();
      const identifier = readIdentifier(expression, 0);
      if (identifier === null || identifier.end !== expression.length) {
        return null;
      }

      chunks.push({ type: 'identifier', value: identifier.value });
      index = expressionEnd + 1;
      continue;
    }

    text += source[index];
    index += 1;
  }

  return null;
}

function splitTopLevelPlus(expression: string) {
  const parts: string[] = [];
  let partStart = 0;

  for (let index = 0; index < expression.length; index += 1) {
    const skipped = skipIgnored(expression, index);
    if (skipped !== null) {
      index = skipped - 1;
      continue;
    }

    if (expression[index] === '(') {
      index = findExpressionBoundary(expression, index + 1, new Set([')']));
      continue;
    }

    if (expression[index] === '+') {
      parts.push(expression.slice(partStart, index).trim());
      partStart = index + 1;
    }
  }

  if (partStart === 0) {
    return null;
  }

  parts.push(expression.slice(partStart).trim());
  return parts;
}

function collectStringDeclarations(source: string) {
  const declarations = new Map<string, string>();

  for (let index = 0; index < source.length; index += 1) {
    const skipped = skipIgnored(source, index);
    if (skipped !== null) {
      index = skipped - 1;
      continue;
    }

    const keyword = readIdentifier(source, index);
    if (
      keyword === null ||
      !['const', 'let', 'var'].includes(keyword.value) ||
      isIdentifierPart(source[index - 1]) ||
      isIdentifierPart(source[keyword.end])
    ) {
      continue;
    }

    index = keyword.end;

    while (index < source.length) {
      index = skipTrivia(source, index);
      const declaration = readIdentifier(source, index);
      if (declaration === null) {
        break;
      }

      index = skipTrivia(source, declaration.end);
      if (source[index] !== '=') {
        break;
      }

      index = skipTrivia(source, index + 1);
      const expressionEnd = findExpressionBoundary(source, index, new Set([',', ';']));
      declarations.set(declaration.value, source.slice(index, expressionEnd).trim());

      index = skipTrivia(source, expressionEnd);
      if (source[index] === ',') {
        continue;
      }

      break;
    }
  }

  return declarations;
}

function resolveStringExpression(
  expression: string,
  declarations: Map<string, string>,
  seen = new Set<string>(),
): string | null {
  const value = expression.trim();

  const stringLiteral = readStringLiteral(value, 0);
  if (stringLiteral !== null && stringLiteral.end === value.length) {
    return stringLiteral.value;
  }

  const templateLiteral = readTemplateLiteral(value, 0);
  if (templateLiteral !== null && templateLiteral.end === value.length) {
    let result = '';

    for (const chunk of templateLiteral.chunks) {
      if (chunk.type === 'text') {
        result += chunk.value;
        continue;
      }

      if (seen.has(chunk.value)) {
        return null;
      }

      const declaration = declarations.get(chunk.value);
      if (!declaration) {
        return null;
      }

      const nextSeen = new Set(seen);
      nextSeen.add(chunk.value);
      const resolved = resolveStringExpression(declaration, declarations, nextSeen);
      if (resolved === null) {
        return null;
      }

      result += resolved;
    }

    return result;
  }

  const parts = splitTopLevelPlus(value);
  if (parts !== null) {
    let result = '';

    for (const part of parts) {
      const resolved = resolveStringExpression(part, declarations, seen);
      if (resolved === null) {
        return null;
      }

      result += resolved;
    }

    return result;
  }

  const identifier = readIdentifier(value, 0);
  if (identifier !== null && identifier.end === value.length && !seen.has(identifier.value)) {
    const declaration = declarations.get(identifier.value);
    if (!declaration) {
      return null;
    }

    const nextSeen = new Set(seen);
    nextSeen.add(identifier.value);
    return resolveStringExpression(declaration, declarations, nextSeen);
  }

  return null;
}

function collectTailwindClassNames(source: VariantSource, classNames: Set<string>) {
  if (isHastRoot(source)) {
    collectLiteralClassNamesFromHast(source, classNames);
  }

  const file = getSourceText(source);
  const declarations = collectStringDeclarations(file);

  for (let index = 0; index < file.length; index += 1) {
    const skipped = skipIgnored(file, index);
    if (skipped !== null) {
      index = skipped - 1;
      continue;
    }

    if (
      !file.startsWith('className', index) ||
      isIdentifierPart(file[index - 1]) ||
      isIdentifierPart(file[index + 'className'.length])
    ) {
      continue;
    }

    index = skipTrivia(file, index + 'className'.length);
    if (file[index] !== '=') {
      continue;
    }

    index = skipTrivia(file, index + 1);

    const stringLiteral = readStringLiteral(file, index);
    if (stringLiteral !== null) {
      addClassNames(classNames, stringLiteral.value);
      index = stringLiteral.end - 1;
      continue;
    }

    if (file[index] !== '{') {
      continue;
    }

    const expressionStart = index + 1;
    const expressionEnd = findExpressionBoundary(file, expressionStart, new Set(['}']));
    const value = resolveStringExpression(file.slice(expressionStart, expressionEnd), declarations);
    if (value !== null) {
      addClassNames(classNames, value);
    }

    index = expressionEnd;
  }
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

const htmlHeadWithTailwind: ExportConfig['headTemplate'] = ({ variant }) => {
  let head = tailwindSetup;

  // Inject css classes used on the page so that initial animations aren't broken
  // Otherwise, TW running in the browser won't see all the classes before the components
  // mount for the first time
  const files = variant
    ? [
        variant.source,
        ...(variant.extraFiles
          ? Object.keys(variant.extraFiles).map((fileName) =>
              variant.extraFiles &&
              typeof variant.extraFiles[fileName] === 'object' &&
              variant.extraFiles[fileName].source
                ? variant.extraFiles[fileName].source
                : undefined,
            )
          : []),
      ]
    : [];

  const classNames = new Set<string>();
  files.forEach((file) => {
    if (!file) {
      return;
    }

    collectTailwindClassNames(file, classNames);
  });

  if (classNames.size > 0) {
    head += tailwindNote;
    head += `<meta name="custom" class="${escapeHtmlAttribute(Array.from(classNames).join(' '))}" />`;
  }

  return head;
};

// Head Template
const htmlHeadTemplate: ExportConfig['headTemplate'] = (props) => {
  const head = [htmlHeadWithDefaultStyles(props)];

  if (props.variantName === 'Tailwind') {
    head.push(htmlHeadWithTailwind(props));
  }

  return head.filter(Boolean).join('\n');
};

// Transform Demo Files at Export
const transformVariant: ExportConfig['transformVariant'] = (variant, variantName, globals) => {
  globals = { ...globals };
  globals['demo.css'] = { source: demoCss };

  return { globals };
};

function exposeMetadataToPublic(extraFiles: VariantExtraFiles | undefined, fileName: string) {
  if (!extraFiles) {
    return; // No extra files to expose
  }

  if (!extraFiles[fileName]) {
    return; // No file to expose
  }

  if (typeof extraFiles[fileName] === 'string') {
    return; // It can't be metadata if it's a string
  }

  // TODO: re-evaluate this
  if (fileName.startsWith('../')) {
    return; // If the file has a backwards path, we don't know how to expose it safely
  }

  // rename the file to be in the public directory
  extraFiles[`public/${fileName}`] = extraFiles[fileName];
  delete extraFiles[fileName];
}

// Transform Variant for Create React App at Export
const transformVariantForCRA: ExportConfig['transformVariant'] = (
  variant,
  variantName,
  globals,
) => {
  const transformed = transformVariant(variant, variantName, globals);
  const { variant: transformedVariant, globals: transformedGlobals } = transformed || {};

  const transformedGlobalsForCRA = { ...transformedGlobals };

  exposeMetadataToPublic(transformedGlobalsForCRA, 'demo.css');

  return {
    variant: transformedVariant,
    globals: transformedGlobalsForCRA,
  };
};

const versions = {
  '@types/react': '^19',
  '@types/react-dom': '^19',
  react: '^19',
  'react-dom': '^19',
};

const COMMIT_REF = process.env.PULL_REQUEST_ID ? process.env.COMMIT_REF : undefined;
const SOURCE_CODE_REPO = process.env.SOURCE_CODE_REPO;

export function resolveDependencies(packageName: string): Record<string, string> {
  switch (packageName) {
    case '@base-ui/react':
    case '@base-ui/utils': {
      const version =
        COMMIT_REF === undefined || SOURCE_CODE_REPO !== 'https://github.com/mui/base-ui'
          ? 'latest' // #npm-tag-reference
          : `https://pkg.pr.new/mui/base-ui/${packageName}@${COMMIT_REF}`;
      return { [packageName]: version };
    }

    default:
      return {
        [packageName]: 'latest',
      };
  }
}

const tsconfigOptions = {
  allowJs: true,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  forceConsistentCasingInFileNames: true,
};

const craTsConfigOptions = {
  ...tsconfigOptions,
  lib: ['dom', 'dom.iterable', 'esnext'],
  moduleResolution: 'node',
  jsx: 'react',
};

export const exportOpts: ExportConfig = {
  titleSuffix: ' - Base UI Example',
  headTemplate: htmlHeadTemplate,
  transformVariant,
  versions,
  resolveDependencies,
  tsconfigOptions,
};

export const exportCodeSandbox: ExportConfig = {
  transformVariant: transformVariantForCRA,
  tsconfigOptions: craTsConfigOptions,
};
