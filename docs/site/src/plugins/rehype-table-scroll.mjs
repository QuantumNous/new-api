import { visit, SKIP } from 'unist-util-visit';

export default function rehypeTableScroll() {
	return (tree) => {
		visit(tree, 'element', (node, index, parent) => {
			if (node.tagName !== 'table' || !parent || index === undefined) return;
			parent.children[index] = {
				type: 'element',
				tagName: 'div',
				properties: { className: ['docs-table-scroll'], tabIndex: 0, role: 'region' },
				children: [node],
			};
			return SKIP;
		});
	};
}
