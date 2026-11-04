import { visit } from 'unist-util-visit';
import { DOCS_BASE } from '../site.mjs';

export default function remarkBasePath() {
	return (tree) => {
		if (!DOCS_BASE) return;
		visit(tree, (node) => {
			if (node.type === 'link' && /^\/(?!\/)/.test(node.url)) node.url = DOCS_BASE + node.url;
			if (node.type === 'html') node.value = node.value.replace(/\b(href|src)="\/(?!\/)/g, `$1="${DOCS_BASE}/`);
		});
	};
}
