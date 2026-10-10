/**
 * typedocProcessor.mjs - Process Typedoc types markdown
 *
 * This module resolves Typedoc components in MDX files to their generated
 * types markdown, parses that markdown, and returns AST nodes to be
 * inserted into the documentation.
 */

import fs from 'fs';
import path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

/**
 * Parse a markdown string into an AST
 * @param {string} markdown - Markdown string to parse
 * @returns {Object} The root content node of the parsed AST
 */
function parseMarkdown(markdown) {
  // Parse markdown into an AST
  const processor = unified().use(remarkParse).use(remarkGfm);
  const result = processor.parse(markdown);
  return result.children;
}

/**
 * Transforms a Typedoc component into markdown code blocks
 * @param {Object} node - The Typedoc JSX node from MDX
 * @param {string} mdxFilePath - Path to the MDX file containing the Typedoc component
 * @returns {Array} Array of markdown nodes to replace the Typedoc component
 */
export function processTypedoc(node, mdxFilePath, typesPath) {
  // Resolve types path relative to the MDX file
  const mdxDir = path.dirname(mdxFilePath);
  typesPath = `${path.resolve(mdxDir, typesPath)}.md`;

  // Check if the types folder exists
  if (!fs.existsSync(typesPath)) {
    throw new Error(
      `Generated Types not found at "${typesPath}". Try running "pnpm --filter docs build" to generate the types first.`,
    );
  }

  const typesContent = fs.readFileSync(typesPath, 'utf-8');

  // Parse the markdown content and add it to the result
  // Removing the leading title and description
  return parseMarkdown(typesContent).splice(3);
}
