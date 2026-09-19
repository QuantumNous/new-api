/**
 * releaseTimelineProcessor.mjs - Process release timeline data
 *
 * This module handles converting release data from releases.ts
 * into markdown AST nodes for LLM documentation output.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
// eslint-disable-next-line import/extensions
import { releases } from '../../src/data/releases.ts';
import * as mdx from './mdxNodeHelpers.mjs';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Format an ISO date string (YYYY-MM-DD) to a human-readable format
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date (e.g., "February 12, 2026")
 */
function formatDate(dateStr) {
  return dateFormatter.format(new Date(dateStr));
}

/**
 * Parse an inline markdown string into AST children of a paragraph.
 * @param {string} text - Markdown string (e.g., "New `Drawer` component.")
 * @returns {Array} Inline AST nodes
 */
function parseInlineMarkdown(text) {
  const tree = unified().use(remarkParse).parse(text);
  // The parser wraps inline content in a paragraph node
  if (tree.children.length === 1 && tree.children[0].type === 'paragraph') {
    return tree.children[0].children;
  }
  return tree.children;
}

/**
 * Generates markdown AST nodes for the release timeline
 * @returns {Array} Array of markdown AST nodes
 */
export function processReleaseTimeline() {
  const nodes = [];

  nodes.push(mdx.heading(2, 'Timeline'));

  for (const release of releases) {
    // Heading with version linked to release page
    const url = `/react/overview/releases/${release.versionSlug}`;
    const headingChildren = [{ type: 'link', url, children: [mdx.text(release.version)] }];
    if (release.latest) {
      headingChildren.push(mdx.text(' (Latest)'));
    }
    nodes.push(mdx.heading(3, headingChildren));

    // Date paragraph
    const dateText = formatDate(release.date);
    nodes.push(mdx.paragraph(mdx.emphasis(dateText)));

    // Highlights as an unordered list
    nodes.push({
      type: 'list',
      ordered: false,
      spread: false,
      children: release.highlights.map((highlight) => ({
        type: 'listItem',
        spread: false,
        children: [{ type: 'paragraph', children: parseInlineMarkdown(highlight) }],
      })),
    });
  }

  return nodes;
}
