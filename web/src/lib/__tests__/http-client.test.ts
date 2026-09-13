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
import axios, { type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('http-client baseURL with route prefix', () => {
  const originalPrefix = (globalThis as { __ROUTE_PREFIX__?: string })
    .__ROUTE_PREFIX__;
  const originalAdapter = axios.defaults.adapter;

  const adapterMock: AxiosAdapter = (config) => {
    const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
    return Promise.resolve({
      data: { url },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
  };

  beforeEach((): void => {
    vi.resetModules();
    axios.defaults.adapter = vi.fn(adapterMock);
  });

  afterEach((): void => {
    if (originalPrefix === undefined) {
      delete (window as { __ROUTE_PREFIX__?: string }).__ROUTE_PREFIX__;
    } else {
      (window as { __ROUTE_PREFIX__?: string }).__ROUTE_PREFIX__ =
        originalPrefix;
    }
    if (originalAdapter) {
      axios.defaults.adapter = originalAdapter;
    }
  });

  it('honours the runtime route prefix as axios baseURL', async () => {
    (window as { __ROUTE_PREFIX__?: string }).__ROUTE_PREFIX__ = '/proxy';
    const mod = await import('../http-client');
    const response = await mod.api.get('/api/status');
    expect(response.data.url).toBe('/proxy/api/status');
  });

  it('uses empty baseURL when no prefix is set', async () => {
    delete (window as { __ROUTE_PREFIX__?: string }).__ROUTE_PREFIX__;
    const mod = await import('../http-client');
    const response = await mod.api.get('/api/status');
    expect(response.data.url).toBe('/api/status');
  });
});