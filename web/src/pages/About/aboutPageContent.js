import { marked } from 'marked';

export function isEmbeddableAboutPageURL(value) {
  return typeof value === 'string' && value.trim().startsWith('https://');
}

export async function loadAboutPageContent(
  requestAboutContent,
  fallbackContent = '',
) {
  try {
    const { success, message, data } = await requestAboutContent();

    if (!success) {
      return {
        content: fallbackContent,
        errorMessage: message || fallbackContent,
        shouldPersist: false,
      };
    }

    const resolvedContent =
      typeof data === 'string' && !isEmbeddableAboutPageURL(data)
        ? marked.parse(data)
        : data;

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
