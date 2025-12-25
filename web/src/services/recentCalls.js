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

import { API } from '../helpers';

export async function getRecentCalls({ limit = 100, beforeId } = {}) {
  const params = {
    limit: Number(limit) || 100,
  };
  if (beforeId !== undefined && beforeId !== null && String(beforeId) !== '') {
    params.before_id = beforeId;
  }

  return await API.get('/api/debug/recent_calls', {
    params,
    skipErrorHandler: true,
  });
}

export async function getRecentCallById(id) {
  return await API.get(`/api/debug/recent_calls/${id}`, {
    skipErrorHandler: true,
  });
}