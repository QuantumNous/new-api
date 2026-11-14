export default {
  html: {
    tags: [
      { tag: 'script', attrs: { src: 'foo.js' } },
      { tag: 'script', attrs: { src: 'https://www.cdn.com/foo.js' } },
      { tag: 'script', attrs: { src: 'bar.js' }, append: false },
      { tag: 'script', attrs: { src: 'baz.js' }, append: false },
      { tag: 'meta', attrs: { name: 'referrer', content: 'origin' } },
      {
        tag: 'link',
        attrs: { ref: 'preconnect', href: 'https://example.com' },
      },
    ],
  },
};
