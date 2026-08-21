import { visit } from 'unist-util-visit';

/** Treat <kbd> as normal tags */
export default function rehypeKbd() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.name === 'kbd') {
        node.tagName = 'kbd';
        node.type = 'element';
        delete node.data;
      }
    });
  };
}
