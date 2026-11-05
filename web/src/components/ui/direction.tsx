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
import { useDirection } from '@base-ui/react/direction-provider'

export {
  DirectionProvider,
  useDirection,
} from '@base-ui/react/direction-provider'

type PhysicalSide = 'top' | 'right' | 'bottom' | 'left'

const RTL_SIDE: Record<PhysicalSide, PhysicalSide> = {
  top: 'top',
  right: 'left',
  bottom: 'bottom',
  left: 'right',
}

/**
 * Layout surfaces (sidebar, sheet) take `left` / `right` as the start / end edge
 * of the page, so they swap in right-to-left layouts. Returns the physical edge
 * to position against.
 */
export function toPhysicalSide(
  side: PhysicalSide,
  direction: ReturnType<typeof useDirection>
): PhysicalSide {
  return direction === 'rtl' ? RTL_SIDE[side] : side
}
