import { describe, expect, it } from 'bun:test';
import { JSDOM } from 'jsdom';

import { createHtmlSanitizer } from './sanitizeHtml';

const sanitizeHtml = createHtmlSanitizer(new JSDOM('').window);

describe('sanitizeHtml', () => {
  it('removes scripts, event handlers, and javascript URLs', () => {
    const dirty = [
      '<script>window.pwned = true</script>',
      '<img src="x" onerror="window.pwned = true">',
      '<a href="javascript:window.pwned=true">click</a>',
    ].join('');

    const clean = sanitizeHtml(dirty);

    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('javascript:');
  });

  it('preserves ordinary markdown output', () => {
    expect(sanitizeHtml('<h2>Title</h2><p><strong>Body</strong></p>')).toBe(
      '<h2>Title</h2><p><strong>Body</strong></p>',
    );
  });

  it('removes inline styles and embedded documents', () => {
    const clean = sanitizeHtml(
      '<p style="background:url(https://tracker.example)">Body</p><iframe src="https://example.com"></iframe>',
    );

    expect(clean).toBe('<p>Body</p>');
  });
});
