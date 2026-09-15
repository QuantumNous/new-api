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
import { useRouterState } from '@tanstack/react-router'

import { isOperatorRoute } from '@/lib/operator-route'
import { useConsoleModeStore } from '@/stores/console-mode-store'

// Operator-only pages always use the developer shell, regardless of the saved preference.
export function useConsoleMode() {
  const preference = useConsoleModeStore((state) => state.mode)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  return isOperatorRoute(pathname) ? 'developer' : preference
}
