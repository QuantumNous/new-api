import createDOMPurify from 'dompurify';
import { marked } from 'marked';

const SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['style', 'srcdoc', 'srcset'],
};

export function createHtmlSanitizer(windowObject) {
  const purifier = createDOMPurify(windowObject);
  return (dirty) => purifier.sanitize(String(dirty ?? ''), SANITIZE_OPTIONS);
}

const browserSanitizer =
  typeof window === 'undefined' ? () => '' : createHtmlSanitizer(window);

export function sanitizeHtml(dirty) {
  return browserSanitizer(dirty);
}

export function renderMarkdown(markdown) {
  return sanitizeHtml(marked.parse(String(markdown ?? '')));
}
