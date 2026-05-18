const allowedReturnToUrls = new Set(['https://partners.infistar.ai/']);
const returnToStorageKey = 'auth_return_to';

export function getAllowedReturnTo(search = window.location.search) {
  const returnTo = new URLSearchParams(search).get('return_to');
  if (!returnTo) {
    return '';
  }

  try {
    const normalizedReturnTo = new URL(returnTo).href;
    return allowedReturnToUrls.has(normalizedReturnTo) ? normalizedReturnTo : '';
  } catch (error) {
    return '';
  }
}

export function persistAllowedReturnTo() {
  const returnTo = getAllowedReturnTo();
  if (returnTo) {
    localStorage.setItem(returnToStorageKey, returnTo);
  }
  return returnTo;
}

export function getPersistedAllowedReturnTo() {
  const returnTo =
    localStorage.getItem(returnToStorageKey) || getAllowedReturnTo();
  return allowedReturnToUrls.has(returnTo) ? returnTo : '';
}

export function clearPersistedReturnTo() {
  localStorage.removeItem(returnToStorageKey);
}

export function redirectAfterAuth(navigate, fallbackPath) {
  const returnTo = getPersistedAllowedReturnTo();
  clearPersistedReturnTo();

  if (returnTo) {
    window.location.assign(returnTo);
    return;
  }

  navigate(fallbackPath);
}

export function withAllowedReturnTo(path) {
  const returnTo = getAllowedReturnTo();
  if (!returnTo) {
    return path;
  }

  return `${path}?return_to=${encodeURIComponent(returnTo)}`;
}
