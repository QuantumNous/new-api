import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';

/** @param {string} markdown */
export function createHast(markdown) {
  const processor = unified().use(remarkParse).use(remarkRehype);
  const mdast = processor.parse(markdown);
  return processor.runSync(mdast);
}
