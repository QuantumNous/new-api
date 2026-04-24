/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export function normalizeBasePath(basePath) {
  const raw = typeof basePath === 'string' ? basePath.trim() : '';
  if (!raw || raw === '/' || raw === '.' || raw === './') {
    return '';
  }

  if (!raw.startsWith('/')) {
    throw new Error('APP_BASE_PATH must start with "/"');
  }
  if (/[?#]/.test(raw)) {
    throw new Error('APP_BASE_PATH must not contain query or fragment');
  }

  const normalized = raw.replace(/\/+$/, '');
  if (!normalized) {
    return '';
  }
  const hasInvalidSegment = normalized
    .split('/')
    .slice(1)
    .some((segment) => segment === '' || segment === '.' || segment === '..');
  if (hasInvalidSegment) {
    throw new Error('APP_BASE_PATH contains invalid path segments');
  }
  return normalized;
}

const runtimeBasePath =
  typeof window !== 'undefined' &&
  window.__NEW_API_RUNTIME__ &&
  typeof window.__NEW_API_RUNTIME__.appBasePath === 'string'
    ? window.__NEW_API_RUNTIME__.appBasePath
    : '';

export const APP_BASE_PATH =
  normalizeBasePath(runtimeBasePath) ||
  normalizeBasePath(import.meta.env?.BASE_URL || '/');

function isAbsoluteUrl(url) {
  return /^(?:[a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

export function withBasePath(url = '/') {
  if (!url) {
    return APP_BASE_PATH || '/';
  }
  if (
    isAbsoluteUrl(url) ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:') ||
    url.startsWith('ccswitch:')
  ) {
    return url;
  }
  if (url.startsWith('#')) {
    return `${APP_BASE_PATH}${url}`;
  }

  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  if (
    !APP_BASE_PATH ||
    normalizedUrl === APP_BASE_PATH ||
    normalizedUrl.startsWith(`${APP_BASE_PATH}/`)
  ) {
    return normalizedUrl;
  }
  return `${APP_BASE_PATH}${normalizedUrl}`;
}

export function getAppOrigin() {
  return `${window.location.origin}${APP_BASE_PATH}`;
}

export function getAbsoluteAppUrl(url = '/') {
  return new URL(withBasePath(url), window.location.origin).toString();
}

export function getApiBaseUrl() {
  return import.meta.env?.VITE_REACT_APP_SERVER_URL || APP_BASE_PATH || '';
}

export function redirectToApp(url) {
  window.location.assign(withBasePath(url));
}

export function openWithBasePath(url, target = '_blank', features) {
  return window.open(withBasePath(url), target, features);
}
