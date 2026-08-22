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
import { isRedirect, redirect } from '@tanstack/react-router'

import { getStatus } from '@/lib/api'

// The sign-up and forgot-password pages (and their links on the sign-in
// page) only make sense while password registration is enabled, so routes
// gated by this helper redirect to sign-in when it is disabled. Defaults to
// enabled when the status endpoint is unreachable so a transient failure
// does not lock users out.
export async function redirectIfPasswordRegisterDisabled(): Promise<void> {
  try {
    const status = await getStatus()
    if (status?.password_register_enabled === false) {
      throw redirect({ to: '/sign-in', replace: true })
    }
  } catch (error) {
    if (isRedirect(error)) {
      throw error
    }
    // status fetch failed: keep the page accessible
  }
}
