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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getRoutePrefix, joinRoutePrefix } from '../route-prefix';

describe('route-prefix', () => {
  const originalPrefix = (globalThis as { __ROUTE_PREFIX__?: string })
    .__ROUTE_PREFIX__;

  afterEach(() => {
    if (typeof window === 'undefined') return;
    if (originalPrefix === undefined) {
      delete window.__ROUTE_PREFIX__;
    } else {
      window.__ROUTE_PREFIX__ = originalPrefix;
    }
  });

  beforeEach(() => {
    if (typeof window === 'undefined') return;
    delete window.__ROUTE_PREFIX__;
  });

  describe('getRoutePrefix', () => {
    it('returns empty when window is unavailable', () => {
      expect(getRoutePrefix()).toBe('');
    });

    it('returns empty for missing prefix', () => {
      expect(getRoutePrefix()).toBe('');
    });

    it('returns empty for "/" or empty string', () => {
      window.__ROUTE_PREFIX__ = '/';
      expect(getRoutePrefix()).toBe('');
      window.__ROUTE_PREFIX__ = '';
      expect(getRoutePrefix()).toBe('');
    });

    it('normalizes trailing slash', () => {
      window.__ROUTE_PREFIX__ = '/proxy/';
      expect(getRoutePrefix()).toBe('/proxy');
    });

    it('adds leading slash when missing', () => {
      window.__ROUTE_PREFIX__ = 'proxy';
      expect(getRoutePrefix()).toBe('/proxy');
    });

    it('collapses consecutive slashes', () => {
      window.__ROUTE_PREFIX__ = '/proxy//v1';
      expect(getRoutePrefix()).toBe('/proxy/v1');
    });

    it('trims whitespace', () => {
      window.__ROUTE_PREFIX__ = '  /proxy  ';
      expect(getRoutePrefix()).toBe('/proxy');
    });
  });

  describe('joinRoutePrefix', () => {
    beforeEach(() => {
      window.__ROUTE_PREFIX__ = '/proxy';
    });

    it('joins prefix with leading-slash suffix', () => {
      expect(joinRoutePrefix('/api/status')).toBe('/proxy/api/status');
    });

    it('joins prefix with suffix missing leading slash', () => {
      expect(joinRoutePrefix('api/status')).toBe('/proxy/api/status');
    });

    it('returns prefix when suffix is empty', () => {
      expect(joinRoutePrefix('')).toBe('/proxy');
    });

    it('returns "/" when both prefix and suffix are empty', () => {
      window.__ROUTE_PREFIX__ = '';
      expect(joinRoutePrefix('')).toBe('/');
      expect(joinRoutePrefix('sign-in')).toBe('/sign-in');
    });
  });
});