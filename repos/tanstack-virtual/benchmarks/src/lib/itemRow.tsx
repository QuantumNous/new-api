import type { Item } from './dataset'

export function ItemRow({
  item,
  itemSize,
  dynamic,
  index,
}: {
  item: Item
  itemSize: number
  dynamic: boolean
  index: number
}) {
  return (
    <div
      data-index={index}
      className={'item ' + (index % 2 === 0 ? 'even' : '')}
      style={{
        minHeight: dynamic ? undefined : itemSize,
        boxSizing: 'border-box',
      }}
    >
      {item.text}
    </div>
  )
}
