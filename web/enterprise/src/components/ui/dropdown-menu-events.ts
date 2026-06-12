import type * as React from 'react'

export type DropdownMenuItemSelectEvent = React.MouseEvent<HTMLElement> & {
  preventBaseUIHandler?: () => void
}

export type DropdownMenuItemSelectHandler = (
  event: DropdownMenuItemSelectEvent
) => void

export function handleDropdownMenuItemSelect(
  event: DropdownMenuItemSelectEvent,
  onClick?: React.MouseEventHandler<HTMLElement>,
  onSelect?: DropdownMenuItemSelectHandler
) {
  onClick?.(event)

  if (!event.defaultPrevented) {
    onSelect?.(event)
  }

  if (event.defaultPrevented) {
    event.preventBaseUIHandler?.()
  }
}
