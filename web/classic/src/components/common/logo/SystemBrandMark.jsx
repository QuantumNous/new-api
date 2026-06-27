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

import React, { useMemo } from 'react';

const DEFAULT_LOGO = '/logo.png';
const DEFAULT_SYSTEM_NAME = 'New API';

function normalizeLogo(logo) {
  const normalizedLogo = String(logo || '').trim();
  if (normalizedLogo === 'undefined' || normalizedLogo === 'null') return '';
  return normalizedLogo;
}

function hasCustomLogo(logo) {
  const normalizedLogo = normalizeLogo(logo);
  if (!normalizedLogo) return false;
  if (normalizedLogo === DEFAULT_LOGO) return false;
  try {
    const baseUrl =
      typeof window === 'undefined'
        ? 'http://localhost/'
        : window.location.href;
    const nextUrl = new URL(normalizedLogo, baseUrl);
    const defaultUrl = new URL(DEFAULT_LOGO, baseUrl);
    return nextUrl.href !== defaultUrl.href;
  } catch {
    return true;
  }
}

function getInitial(systemName) {
  const normalizedName = String(systemName || '').trim();
  const match = normalizedName.match(/[\p{L}\p{N}]/u);
  return (match?.[0] || 'A').toLocaleUpperCase();
}

function escapeSvgText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function shouldUseGeneratedBrandMark(systemName, logo) {
  return (
    String(systemName || '').trim() !== DEFAULT_SYSTEM_NAME &&
    !hasCustomLogo(logo)
  );
}

export function getSystemBrandMarkFaviconHref(systemName, logo) {
  if (!shouldUseGeneratedBrandMark(systemName, logo)) {
    return normalizeLogo(logo) || DEFAULT_LOGO;
  }

  const initial = escapeSvgText(getInitial(systemName));
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <text x="32" y="42" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="39" font-weight="700" fill="#0f172a">${initial}</text>
  <path d="M13 42H34C39 42 40 35 45 35H53" fill="none" stroke="#22d3ee" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 49H32C37 49 39 45 43 45H48" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.72"/>
  <path d="M14 42H34C39 42 40 35 45 35H53" fill="none" stroke="#0f172a" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0.18"/>
  <circle cx="53" cy="35" r="5.4" fill="#0f172a" opacity="0.12"/>
  <circle cx="53" cy="35" r="3.1" fill="#22d3ee"/>
  <rect x="18" y="46.5" width="8" height="3.4" rx="1.2" fill="#fb6f3d" opacity="0.82" transform="rotate(-18 22 48.2)"/>
</svg>`.trim();

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const brandMarkStyles = `
@keyframes system-brand-route-sweep {
  0% {
    offset-distance: 0%;
    opacity: 0;
  }
  12%,
  82% {
    opacity: 1;
  }
  100% {
    offset-distance: 100%;
    opacity: 0;
  }
}

.system-brand-mark:hover .system-brand-mark__node {
  animation: system-brand-route-sweep 1.15s cubic-bezier(0.16, 1, 0.3, 1) 1;
}

.system-brand-mark:hover .system-brand-mark__route {
  opacity: 1;
  transform: translateX(1px);
}

@media (prefers-reduced-motion: reduce) {
  .system-brand-mark:hover .system-brand-mark__node {
    animation: none;
  }

  .system-brand-mark:hover .system-brand-mark__route {
    transform: none;
  }
}
`;

const SystemBrandMark = ({
  logo,
  systemName,
  size = 32,
  className = '',
  imageClassName = '',
  alt,
}) => {
  const initial = useMemo(() => getInitial(systemName), [systemName]);
  const shouldGenerate = shouldUseGeneratedBrandMark(systemName, logo);
  const label = alt || systemName || 'Logo';

  if (!shouldGenerate) {
    return (
      <img
        src={logo || DEFAULT_LOGO}
        alt={label}
        className={
          imageClassName ||
          `inline-block shrink-0 rounded-full object-cover ${className}`
        }
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`system-brand-mark relative inline-flex shrink-0 items-center justify-center overflow-visible rounded-xl text-slate-950 dark:text-white ${className}`}
      style={{ width: size, height: size }}
      role='img'
      aria-label={label}
    >
      <style>{brandMarkStyles}</style>
      <span
        className='relative z-10 -translate-y-[1px] font-semibold leading-none tracking-tight'
        style={{ fontSize: Math.max(14, Math.round(size * 0.64)) }}
      >
        {initial}
      </span>
      <svg
        className='pointer-events-none absolute inset-[-2px] z-20'
        viewBox='0 0 64 64'
        aria-hidden='true'
      >
        <path
          className='system-brand-mark__route origin-center opacity-90 transition duration-300'
          d='M13 42H34C39 42 40 35 45 35H53'
          fill='none'
          stroke='#22d3ee'
          strokeWidth='5.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <path
          d='M16 49H32C37 49 39 45 43 45H48'
          fill='none'
          stroke='#38bdf8'
          strokeWidth='3'
          strokeLinecap='round'
          strokeLinejoin='round'
          opacity='0.72'
        />
        <path
          d='M14 42H34C39 42 40 35 45 35H53'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.3'
          strokeLinecap='round'
          strokeLinejoin='round'
          opacity='0.18'
        />
        <circle cx='53' cy='35' r='5.4' fill='currentColor' opacity='0.12' />
        <circle cx='53' cy='35' r='3.1' fill='#22d3ee' />
        <rect
          x='18'
          y='46.5'
          width='8'
          height='3.4'
          rx='1.2'
          fill='#fb6f3d'
          opacity='0.82'
          transform='rotate(-18 22 48.2)'
        />
        <circle
          className='system-brand-mark__node'
          r='2.4'
          fill='#f59e0b'
          style={{
            offsetPath: "path('M13 42H34C39 42 40 35 45 35H53')",
            offsetDistance: '100%',
            opacity: 0,
          }}
        />
      </svg>
    </span>
  );
};

export default SystemBrandMark;
