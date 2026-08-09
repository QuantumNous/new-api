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

export const loadTokenForEdit = async ({ getToken, getAssignments }) => {
  const [tokenResult, assignmentResult] = await Promise.allSettled([
    getToken(),
    getAssignments(),
  ]);

  if (tokenResult.status !== 'fulfilled') {
    return {
      success: false,
      message: '',
      data: null,
      entitlementAssignmentsAvailable: false,
    };
  }

  const tokenResponse = tokenResult.value?.data;
  if (!tokenResponse?.success || !tokenResponse.data) {
    return {
      success: false,
      message: tokenResponse?.message || '',
      data: null,
      entitlementAssignmentsAvailable: false,
    };
  }

  const assignmentResponse =
    assignmentResult.status === 'fulfilled'
      ? assignmentResult.value?.data
      : null;
  const entitlementAssignmentsAvailable =
    assignmentResponse?.success === true &&
    Array.isArray(assignmentResponse.data);
  const data = { ...tokenResponse.data };
  if (entitlementAssignmentsAvailable) {
    data.entitlement_package_ids = assignmentResponse.data
      .filter((item) => item.status === 1)
      .map((item) => item.package_id);
  }

  return {
    success: true,
    message: tokenResponse.message || '',
    data,
    entitlementAssignmentsAvailable,
  };
};

export const omitEntitlementPackageIdsWhenUnavailable = (
  payload,
  entitlementAssignmentsAvailable,
) => {
  if (entitlementAssignmentsAvailable) return payload;
  const nextPayload = { ...payload };
  delete nextPayload.entitlement_package_ids;
  return nextPayload;
};
