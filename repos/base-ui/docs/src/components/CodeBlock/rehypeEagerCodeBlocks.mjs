import { visit, EXIT, CONTINUE } from 'unist-util-visit';

const EAGER_COUNT = 2;

export default function rehypeEagerCodeBlocks() {
  return (tree) => {
    let count = 0;
    visit(tree, 'element', (node) => {
      if (node.tagName === 'pre' && node.properties?.dataPrecompute) {
        node.properties.dataHighlightAfter = 'init';
        node.properties.dataEnhanceAfter = 'init';
        count += 1;
        if (count >= EAGER_COUNT) {
          return EXIT;
        }
      }
      return CONTINUE;
    });
  };
}
