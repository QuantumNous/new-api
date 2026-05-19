const allowedReturnToPaths = new Set(['/partners/promoter']);
const returnToStorageKey = 'auth_return_to';

export function getAllowedReturnTo(search = window.location.search) {
  const params = new URLSearchParams(search);
  const returnTo = params.get('return_to');
  if (!returnTo) {
    return '';
  }

  if (!returnTo.startsWith('/')) {
    return '';
  }
  const normalizedReturnTo = new URL(returnTo, window.location.origin);
  if (normalizedReturnTo.origin !== window.location.origin) {
    return '';
  }
  return allowedReturnToPaths.has(normalizedReturnTo.pathname)
    ? `${normalizedReturnTo.pathname}${normalizedReturnTo.search}`
    : '';
}

export function persistAllowedReturnTo(search = window.location.search) {
  const returnTo = getAllowedReturnTo(search);
  if (returnTo) {
    localStorage.setItem(returnToStorageKey, returnTo);
  }
  return returnTo;
}

export function getPersistedAllowedReturnTo() {
  const returnTo =
    getAllowedReturnTo() || localStorage.getItem(returnToStorageKey);
  if (!returnTo) return '';
  const normalizedReturnTo = new URL(returnTo, window.location.origin);
  return allowedReturnToPaths.has(normalizedReturnTo.pathname)
    ? `${normalizedReturnTo.pathname}${normalizedReturnTo.search}`
    : '';
}

export function clearPersistedReturnTo() {
  localStorage.removeItem(returnToStorageKey);
}

export function redirectAfterAuth(
  navigate,
  fallbackPath,
  search = window.location.search,
) {
  const returnTo = getAllowedReturnTo(search) || getPersistedAllowedReturnTo();

  if (returnTo) {
    navigate(returnTo, { replace: true });
    return;
  }

  clearPersistedReturnTo();
  navigate(fallbackPath, { replace: true });
}

export function getAuthRedirectPath(search = window.location.search) {
  const returnTo = getAllowedReturnTo(search) || getPersistedAllowedReturnTo();
  return returnTo || '/console';
}

export function withAllowedReturnTo(path) {
  const returnTo = getAllowedReturnTo();
  if (!returnTo) {
    return path;
  }

  return `${path}?return_to=${encodeURIComponent(returnTo)}`;
}
