/*
Copyright (C) 2023-2026 QuantumNous

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

declare global {
  interface Window {
    __ROUTE_PREFIX__?: string;
  }
}

const FALLBACK_PREFIX = '';

function normalize(raw: unknown): string {
  if (typeof raw !== 'string') return FALLBACK_PREFIX;
  let value = raw.trim();
  if (value === '' || value === '/') return FALLBACK_PREFIX;
  if (!value.startsWith('/')) value = `/${value}`;
  while (value.includes('//')) value = value.replace('//', '/');
  value = value.replace(/\/+$/, '');
  if (value === '' || value === '/') return FALLBACK_PREFIX;
  return value;
}

export function getRoutePrefix(): string {
  if (typeof window === 'undefined') return FALLBACK_PREFIX;
  return normalize(window.__ROUTE_PREFIX__);
}

export function joinRoutePrefix(suffix: string): string {
  const prefix = getRoutePrefix();
  let s = (suffix ?? '').trim();
  if (s === '') {
    return prefix === '' ? '/' : prefix;
  }
  if (!s.startsWith('/')) s = `/${s}`;
  return prefix === '' ? s : `${prefix}${s}`;
}

export function withRoutePrefix(path: string): string {
  return joinRoutePrefix(path);
}