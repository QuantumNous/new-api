// @ts-check
import { headingRank } from 'hast-util-heading-rank';
import { visit } from 'unist-util-visit';
import { createMdxElement } from 'docs/src/mdx/createMdxElement.mjs';

const ROOT = 'QuickNav.Root';
const TITLE = 'QuickNav.Title';
const CONTENT = 'QuickNav.Content';
const LIST = 'QuickNav.List';
const ITEM = 'QuickNav.Item';
const LINK = 'QuickNav.Link';

/**
 * @typedef {Object} TocEntry
 * @property {string} value
 * @property {number} depth
 * @property {string} [id]
 * @property {TocEntry[]} [children]
 */

/**
 * @returns {(tree: any, file: any) => void}
 */
export default function rehypeQuickNav() {
  return (tree, file) => {
    /** @type {TocEntry[]} */
    const toc = file.data.toc ?? [];
    const content = createMdxElement({
      name: CONTENT,
      children: tree.children,
    });

    if (!toc.length) {
      tree.children = [content];
      return;
    }

    const excludedIds = collectExcludedHeadingIds(tree);
    const filteredToc = filterToc(toc, excludedIds);

    if (!filteredToc.length) {
      tree.children = [content];
      return;
    }

    const root = createMdxElement({
      name: ROOT,
      children: filteredToc.flatMap(getNodeFromEntry).filter(Boolean),
    });
    tree.children = [root, content];
  };
}

/**
 * @param {TocEntry} entry
 * @returns {Record<string, unknown> | Record<string, unknown>[]}
 */
function getNodeFromEntry({ value, depth, id, children }) {
  const sub = createMdxElement({
    name: LIST,
    children: [],
  });

  // Ignore <h4>'s and below
  if (depth < 3 && children?.length) {
    sub.children = children.map(getNodeFromEntry);
  }

  if (depth === 1) {
    // Insert "(Top)" link
    sub.children?.unshift(getNodeFromEntry({ value: '(Top)', id: '', depth: 2 }));

    return [
      // Insert a top-level title
      createMdxElement({
        name: TITLE,
        children: [{ type: 'text', value }],
      }),
      sub,
    ];
  }

  const link = createMdxElement({
    name: LINK,
    children: [{ type: 'text', value }],
    props: {
      href: `#${id}`,
    },
  });

  return createMdxElement({
    name: ITEM,
    children: [link, sub],
  });
}

/**
 * @param {import('hast').Root} tree
 * @returns {Set<string>}
 */
function collectExcludedHeadingIds(tree) {
  const excluded = new Set();
  visit(tree, 'element', (node) => {
    if (!headingRank(node)) {
      return;
    }
    const props = node.properties ?? {};
    // MDX keeps the kebab-case key; standard remark-rehype would camelCase it.
    if (
      props.id &&
      (props.dataExcludeToc !== undefined || props['data-exclude-toc'] !== undefined)
    ) {
      excluded.add(String(props.id));
    }
  });
  return excluded;
}

/**
 * @param {TocEntry[]} entries
 * @param {Set<string>} excludedIds
 * @returns {TocEntry[]}
 */
function filterToc(entries, excludedIds) {
  if (!entries?.length) {
    return entries ?? [];
  }
  return entries
    .filter((entry) => !excludedIds.has(String(entry.id ?? '')))
    .map((entry) => ({
      ...entry,
      children: entry.children?.length ? filterToc(entry.children, excludedIds) : undefined,
    }));
}
