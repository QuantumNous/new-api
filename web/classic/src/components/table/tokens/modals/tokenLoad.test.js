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

import { describe, expect, test } from 'bun:test';
import {
  loadTokenForEdit,
  omitEntitlementPackageIdsWhenUnavailable,
} from './tokenLoad';

describe('Classic token edit loading', () => {
  test('token data remains editable when entitlement lookup fails', async () => {
    const result = await loadTokenForEdit({
      getToken: async () => ({
        data: { success: true, data: { id: 7, name: 'legacy-token' } },
      }),
      getAssignments: async () => {
        throw new Error('optional entitlement table unavailable');
      },
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 7, name: 'legacy-token' });
    expect(result.entitlementAssignmentsAvailable).toBe(false);
    expect(
      omitEntitlementPackageIdsWhenUnavailable(
        { name: 'renamed', entitlement_package_ids: [] },
        result.entitlementAssignmentsAvailable,
      ),
    ).toEqual({ name: 'renamed' });
  });

  test('successful assignment lookup includes only active packages', async () => {
    const result = await loadTokenForEdit({
      getToken: async () => ({
        data: { success: true, data: { id: 8, name: 'entitled-token' } },
      }),
      getAssignments: async () => ({
        data: {
          success: true,
          data: [
            { package_id: 3, status: 1 },
            { package_id: 4, status: 0 },
          ],
        },
      }),
    });

    expect(result.entitlementAssignmentsAvailable).toBe(true);
    expect(result.data.entitlement_package_ids).toEqual([3]);
    expect(
      omitEntitlementPackageIdsWhenUnavailable(
        { entitlement_package_ids: [3] },
        result.entitlementAssignmentsAvailable,
      ),
    ).toEqual({ entitlement_package_ids: [3] });
  });
});
