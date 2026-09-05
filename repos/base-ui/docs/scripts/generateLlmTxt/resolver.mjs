import { visit } from 'unist-util-visit';

export function isAbsoluteUrl(url) {
  try {
    return !!new URL(url);
  } catch {
    return false;
  }
}

export function resolveUrl(url, base) {
  if (isAbsoluteUrl(base)) {
    return new URL(url, base).href;
  }
  const baseUrl = new URL(base, 'https://example.com');
  const absUrl = new URL(url, baseUrl).href;
  return absUrl.slice(baseUrl.origin.length);
}

export function resolveMdLink(link, { urlPath, urlsWithMdVersion }) {
  if (isAbsoluteUrl(link)) {
    return link;
  }

  // If no urlPath is provided, return the link as-is
  if (!urlPath) {
    return link;
  }

  const resolvedPath = new URL(link, new URL(urlPath, 'https://example.com')).pathname;

  if (urlsWithMdVersion?.has(resolvedPath)) {
    return `${resolvedPath}.md`;
  }

  return resolvedPath;
}

export function resolveMdLinks({ urlPath, urlsWithMdVersion }) {
  return (tree) => {
    visit(tree, 'link', (node) => {
      if (!node.url || isAbsoluteUrl(node.url)) {
        return;
      }

      node.url = resolveMdLink(node.url, { urlPath, urlsWithMdVersion });
    });
  };
}
