/* eslint-disable no-plusplus */
import { headingRank } from 'hast-util-heading-rank';
import { toString } from 'hast-util-to-string';
import { visit, CONTINUE, EXIT } from 'unist-util-visit';
import { stringToUrl } from './rehypeSlug.mjs';

export default function rehypeConcatHeadings() {
  return (tree) => {
    /**
     * Forms page: prefix <h3>s under React Hook Form/TanStack Form with the library name
     */
    visit(tree, 'element', (node, _, parent) => {
      if (headingRank(node) === 1 && toString(node) !== 'Forms') {
        return EXIT;
      }

      if (headingRank(node) === 3) {
        let index = parent.children.indexOf(node);
        while (index--) {
          const candidate = parent.children[index];
          if (headingRank(candidate) === 2) {
            const h2Text = toString(candidate);
            if (h2Text === 'React Hook Form' || h2Text === 'TanStack Form') {
              const h3Text = toString(node);
              node.properties.id = stringToUrl(`${h2Text} ${h3Text}`);
              break;
            }
          }
        }
      } else if (headingRank(node) && !node.properties.id) {
        node.properties.id = stringToUrl(toString(node));
      }
      return CONTINUE;
    });
  };
}
