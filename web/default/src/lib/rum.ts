/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { Metric } from 'web-vitals'

function reportWebVital(metric: Metric) {
  void fetch('/api/rum', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    keepalive: true,
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
    }),
  }).catch(() => undefined)
}

export async function initializeRUM() {
  if (
    !import.meta.env.PROD ||
    navigator.doNotTrack === '1' ||
    navigator.doNotTrack === 'yes'
  ) {
    return
  }
  const { onCLS, onINP, onLCP } = await import('web-vitals')
  onCLS(reportWebVital)
  onINP(reportWebVital)
  onLCP(reportWebVital)
}
