import { visit } from 'unist-util-visit';
import { fillPlaceholders } from '../site.mjs';

export default function remarkApiHost() {
	return (tree) => {
		visit(tree, (node) => {
			if (typeof node.value === 'string') node.value = fillPlaceholders(node.value);
			if (typeof node.url === 'string') node.url = fillPlaceholders(node.url);
		});
	};
}
