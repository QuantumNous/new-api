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

// The control panel stays current without hammering the aggregate endpoints:
// heavy overview panels poll every 30 seconds, and only while the tab is
// visible (refetchIntervalInBackground is false on every panel query).
export const LIVE_REFRESH_MS = 30_000

// All-time revenue scans the whole statistics range, so it refreshes far less
// often than the live cards.
export const ALL_TIME_REFRESH_MS = 5 * 60_000
