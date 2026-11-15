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
import { createContext, type KeyboardEvent, type PointerEvent } from 'react'

type PriorityControls = {
  reason: 'sort' | 'tag' | 'permission' | 'busy' | null
  start: (event: PointerEvent<HTMLButtonElement>, id: number) => void
  keyDown: (event: KeyboardEvent<HTMLButtonElement>, id: number) => void
}

export const ChannelPriorityContext = createContext<PriorityControls | null>(
  null
)
