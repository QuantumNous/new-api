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
import {
  useLayoutEffect,
  useRef,
  type ReactNode,
  type SyntheticEvent,
} from 'react'

import { findScrollContainer } from '@/lib/scroll'

type Props = {
  children: ReactNode
  pagination: ReactNode
  resetKey: unknown
  pageIndex: number
}

// Keep the scroll position across page replacement without reserving empty rows.
export function PaginationFrame(props: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const pendingScroll = useRef<{
    element: HTMLElement
    top: number
    pageIndex: number
    resetKey: unknown
  } | null>(null)

  useLayoutEffect(() => {
    const pending = pendingScroll.current
    pendingScroll.current = null
    if (
      !pending ||
      pending.pageIndex === props.pageIndex ||
      pending.resetKey !== props.resetKey
    ) {
      return
    }
    const maximum = Math.max(
      0,
      pending.element.scrollHeight - pending.element.clientHeight
    )
    pending.element.scrollTop = Math.min(pending.top, maximum)
  }, [props.pageIndex, props.resetKey])

  const rememberScroll = (event: SyntheticEvent<HTMLDivElement>) => {
    pendingScroll.current = null
    if (!(event.target instanceof Element)) return
    const button = event.target.closest('button')
    if (!button || button.disabled) return
    const element = findScrollContainer(frameRef.current)
    if (element) {
      pendingScroll.current = {
        element,
        top: element.scrollTop,
        pageIndex: props.pageIndex,
        resetKey: props.resetKey,
      }
    }
  }

  return (
    <div
      ref={frameRef}
      className='space-y-3 [overflow-anchor:none]'
      data-slot='pagination-frame'
    >
      <div data-slot='pagination-frame-content'>{props.children}</div>
      {props.pagination && (
        <div
          onPointerDownCapture={rememberScroll}
          onClickCapture={(event) => {
            // Pointer focus can scroll before click; keyboard clicks start here.
            if (event.detail === 0 || !pendingScroll.current) {
              rememberScroll(event)
            }
          }}
        >
          {props.pagination}
        </div>
      )}
    </div>
  )
}
