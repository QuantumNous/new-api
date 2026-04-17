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

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePoolsData } from './usePoolsData';

vi.mock('@douyinfe/semi-ui', () => ({
  Button: () => null,
  Space: ({ children }) => children || null,
  Tag: ({ children }) => children || null,
}));

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('../../helpers', () => ({
  API: {
    get: mockGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

describe('usePoolsData', () => {
  beforeEach(() => {
    mockGet.mockImplementation((url) => {
      if (url.startsWith('/api/pool/binding')) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              items: [{ id: 1, binding_type: 'token', binding_value: '1', pool_id: 1 }],
              total: 1,
              page: 1,
            },
          },
        });
      }
      if (url.startsWith('/api/pool/?')) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              items: [{ id: 1, name: 'default-pool', status: 1 }],
              total: 1,
              page: 1,
            },
          },
        });
      }
      if (url.startsWith('/api/pool/channel')) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              items: [{ id: 9, pool_id: 1, channel_id: 1001, enabled: true }],
              total: 1,
              page: 1,
            },
          },
        });
      }
      return Promise.resolve({
        data: {
          success: true,
          data: { items: [], total: 0, page: 1 },
        },
      });
    });
  });

  afterEach(() => {
    mockGet.mockReset();
  });

  it('loads bindings on mount and channels on tab switch', async () => {
    const { result } = renderHook(() => usePoolsData());

    await waitFor(() => {
      expect(result.current.bindingItems).toHaveLength(1);
    });
    expect(mockGet).toHaveBeenCalledWith(
      '/api/pool/binding?p=1&page_size=20&binding_type=token',
    );

    await act(async () => {
      await result.current.handleTabChange('channel');
    });

    await waitFor(() => {
      expect(result.current.channelItems).toHaveLength(1);
    });
    expect(mockGet).toHaveBeenCalledWith('/api/pool/channel?p=1&page_size=20');
  });

  it('builds usage query with both scope_id and explicit scope key', async () => {
    const { result } = renderHook(() => usePoolsData());

    await act(async () => {
      result.current.setUsageQuery({
        pool_id: '1',
        scope_type: 'user',
        scope_id: '42',
        window: '7d',
      });
    });

    await act(async () => {
      await result.current.queryUsage();
    });

    const usageCall = mockGet.mock.calls.find(([url]) =>
      url.startsWith('/api/pool/usage?'),
    );
    expect(usageCall).toBeTruthy();
    expect(usageCall[0]).toContain('pool_id=1');
    expect(usageCall[0]).toContain('scope_type=user');
    expect(usageCall[0]).toContain('scope_id=42');
    expect(usageCall[0]).toContain('user_id=42');
    expect(usageCall[0]).toContain('token_id=42');
    expect(usageCall[0]).toContain('window=7d');
  });

  it('builds token usage query with explicit token_id and user_id', async () => {
    const { result } = renderHook(() => usePoolsData());

    await act(async () => {
      result.current.setUsageQuery({
        pool_id: '1',
        scope_type: 'token',
        scope_id: '99',
        window: '5h',
      });
    });

    await act(async () => {
      await result.current.queryUsage();
    });

    const usageCall = mockGet.mock.calls.find(([url]) =>
      url.includes('/api/pool/usage?') &&
      url.includes('scope_type=token') &&
      url.includes('scope_id=99'),
    );
    expect(usageCall).toBeTruthy();
    expect(usageCall[0]).toContain('token_id=99');
    expect(usageCall[0]).toContain('user_id=99');
  });
});

