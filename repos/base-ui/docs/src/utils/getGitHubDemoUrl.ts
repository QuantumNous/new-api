import kebabCase from 'es-toolkit/compat/kebabCase';

export const GITHUB_BASE = 'https://github.com/mui/base-ui/tree/HEAD';

/**
 * Converts a file:// URL from import.meta.url to a GitHub source URL
 * for the demo directory, optionally targeting a specific variant subdirectory.
 */
export function getGitHubDemoUrl(
  fileUrl: string | undefined,
  selectedVariant?: string,
): string | null {
  if (!fileUrl) {
    return null;
  }

  try {
    const normalized = decodeURIComponent(fileUrl).replace(/\\/g, '/');

    const docsIndex = normalized.indexOf('/docs/');
    if (docsIndex === -1) {
      return null;
    }

    // Extract from "docs/" onward
    const repoRelativePath = normalized.slice(docsIndex + 1);

    // Strip the trailing filename to get the directory
    const lastSlash = repoRelativePath.lastIndexOf('/');
    if (lastSlash === -1) {
      return null;
    }
    let dirPath = repoRelativePath.slice(0, lastSlash);

    if (selectedVariant && selectedVariant !== 'Default') {
      dirPath += `/${kebabCase(selectedVariant)}`;
    }

    return `${GITHUB_BASE}/${dirPath}`;
  } catch {
    return null;
  }
}
