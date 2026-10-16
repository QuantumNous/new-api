import type { Element } from 'hast';
import type { Node } from 'unist';
import { visit, CONTINUE, SKIP } from 'unist-util-visit';
import type { MdxJsxFlowElement, MdxJsxAttribute } from 'mdast-util-mdx-jsx';

export interface RehypeExtractLinkUrlsOptions {
  onCompleted?: (links: Set<string>) => void;
}

/**
 * A simple rehype plugin that extracts all link URLs from an MD(X) file.
 */
export function rehypeExtractLinkUrls(options: RehypeExtractLinkUrlsOptions) {
  const foundLinks = new Set<string>();

  const visitor = (node: Node) => {
    if (node.type === 'element') {
      const element = node as Element;
      if (element.tagName === 'a' && element.properties.href != null) {
        foundLinks.add(element.properties.href as string);
        return SKIP;
      }
    }

    if (node.type === 'mdxJsxFlowElement') {
      const element = node as MdxJsxFlowElement;
      if (element.name === 'a') {
        const hrefAttribute = element.attributes.find(
          (attr) => (attr as MdxJsxAttribute).name === 'href',
        );
        if (hrefAttribute != null && hrefAttribute.value != null) {
          foundLinks.add(hrefAttribute.value as string);
        }

        return SKIP;
      }
    }

    return CONTINUE;
  };

  return (tree: Node) => {
    visit(tree, visitor);
    options.onCompleted?.(foundLinks);
  };
}
