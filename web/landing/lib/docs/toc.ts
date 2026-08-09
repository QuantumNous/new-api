import GithubSlugger from "github-slugger";
import { toString } from "mdast-util-to-string";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import type { DocTableOfContentsItem } from "@/lib/docs/types";

export function getTableOfContents(content: string): DocTableOfContentsItem[] {
  const tree = unified().use(remarkParse).parse(content);
  const slugger = new GithubSlugger();
  const items: DocTableOfContentsItem[] = [];

  visit(tree, "heading", (node) => {
    if (node.depth === 1) {
      throw new Error("文档正文不能包含一级标题（#）；页面标题已由 frontmatter 的 title 生成。");
    }

    if (node.depth !== 2 && node.depth !== 3) return;

    const title = toString(node).trim();
    if (!title) return;

    items.push({
      depth: node.depth,
      title,
      id: slugger.slug(title),
    });
  });

  return items;
}
