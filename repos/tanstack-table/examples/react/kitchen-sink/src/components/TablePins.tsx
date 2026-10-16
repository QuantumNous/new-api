import { ColumnPinningPosition } from '@tanstack/react-table'
import React from 'react'

type Props = {
  isPinned: ColumnPinningPosition
  pin: (position: ColumnPinningPosition) => void
}

export const TablePins: React.FC<Props> = ({ isPinned, pin }) => {
  const pinLeft = () => pin('left')
  const unPin = () => pin(false)
  const pinRight = () => pin('right')

  return (
    <div className="flex gap-1 justify-center">
      {isPinned !== 'left' ? (
        <button className="border rounded px-2" onClick={pinLeft}>
          {'<='}
        </button>
      ) : null}
      {isPinned ? (
        <button className="border rounded px-2" onClick={unPin}>
          X
        </button>
      ) : null}
      {isPinned !== 'right' ? (
        <button className="border rounded px-2" onClick={pinRight}>
          {'=>'}
        </button>
      ) : null}
    </div>
  )
}

export default TablePins
