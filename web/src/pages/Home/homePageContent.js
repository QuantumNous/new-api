import { postIframeContext } from '../../helpers/iframeContext.js';
import { marked } from 'marked';

function getCurrentWindowOrigin() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.location?.origin || '';
}

function normalizeOrigin(origin) {
  if (typeof origin !== 'string') {
    return '';
  }

  const trimmed = origin.trim();
  if (!trimmed) {
    return '';
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

export function isEmbeddableHomePageURL(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/')
  );
}

export function isRouteManagerHubHomePageURL(
  value,
  currentOrigin = getCurrentWindowOrigin(),
) {
  if (!isEmbeddableHomePageURL(value)) {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith('/')) {
    const [pathname] = trimmed.split('?');
    return pathname === '/hub' || pathname === '/hub/';
  }

  try {
    const parsedURL = new URL(trimmed);
    const isHubPath =
      parsedURL.pathname === '/hub' || parsedURL.pathname === '/hub/';
    if (!isHubPath) {
      return false;
    }

    const normalizedCurrentOrigin = normalizeOrigin(currentOrigin);
    if (!normalizedCurrentOrigin) {
      return true;
    }

    return parsedURL.origin === normalizedCurrentOrigin;
  } catch {
    return false;
  }
}

export function postHomePageIframeContext(
  iframe,
  { themeMode = '', lang = '' } = {},
) {
  return postIframeContext(iframe, { themeMode, lang });
}

export async function loadHomePageContent(
  requestHomePageContent,
  fallbackContent = '',
) {
  try {
    const { success, message, data } = await requestHomePageContent();

    if (!success) {
      return {
        content: fallbackContent,
        errorMessage: message || fallbackContent,
        shouldPersist: false,
      };
    }

    if (typeof data !== 'string') {
      return {
        content: fallbackContent,
        errorMessage: message || fallbackContent,
        shouldPersist: false,
      };
    }

    const resolvedContent =
      !isEmbeddableHomePageURL(data) ? marked.parse(data) : data;

    return {
      content: resolvedContent,
      errorMessage: '',
      shouldPersist: true,
    };
  } catch {
    return {
      content: fallbackContent,
      errorMessage: fallbackContent,
      shouldPersist: false,
    };
  }
}
