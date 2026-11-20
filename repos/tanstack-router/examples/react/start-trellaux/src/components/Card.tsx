import { invariant } from '../invariant'
import { forwardRef, useState } from 'react'

import { CONTENT_TYPES } from '../types'
import { Icon } from '../icons/icons'
import { useDeleteCardMutation, useUpdateCardMutation } from '../queries'
import { deleteItemSchema } from '../db/schema'

interface CardProps {
  title: string
  content: string | null
  id: string
  columnId: string
  boardId: string
  order: number
  nextOrder: number
  previousOrder: number
}

export const Card = forwardRef<HTMLLIElement, CardProps>(
  (
    { title, content, id, columnId, boardId, order, nextOrder, previousOrder },
    ref,
  ) => {
    const [acceptDrop, setAcceptDrop] = useState<'none' | 'top' | 'bottom'>(
      'none',
    )

    const deleteCard = useDeleteCardMutation()
    const moveCard = useUpdateCardMutation()

    return (
      <li
        ref={ref}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(CONTENT_TYPES.card)) {
            event.preventDefault()
            event.stopPropagation()
            const rect = event.currentTarget.getBoundingClientRect()
            const midpoint = (rect.top + rect.bottom) / 2
            setAcceptDrop(event.clientY <= midpoint ? 'top' : 'bottom')
          }
        }}
        onDragLeave={() => {
          setAcceptDrop('none')
        }}
        onDrop={(event) => {
          event.stopPropagation()

          const transfer = JSON.parse(
            event.dataTransfer.getData(CONTENT_TYPES.card) || 'null',
          )

          if (!transfer) {
            return
          }

          invariant(transfer.id, 'missing cardId')
          invariant(transfer.title, 'missing title')

          const droppedOrder = acceptDrop === 'top' ? previousOrder : nextOrder
          const moveOrder = (droppedOrder + order) / 2

          moveCard.mutate({
            data: {
              order: moveOrder,
              columnId,
              boardId,
              id: transfer.id,
              title: transfer.title,
            },
          })

          setAcceptDrop('none')
        }}
        className={
          'border-t-2 border-b-2 -mb-[2px] last:mb-0 cursor-grab active:cursor-grabbing px-2 py-1 ' +
          (acceptDrop === 'top'
            ? 'border-t-red-500 border-b-transparent'
            : acceptDrop === 'bottom'
              ? 'border-b-red-500 border-t-transparent'
              : 'border-t-transparent border-b-transparent')
        }
      >
        <div
          draggable
          className="bg-white shadow-sm shadow-slate-300 border-slate-300 text-sm rounded-lg w-full py-1 px-2 relative"
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData(
              CONTENT_TYPES.card,
              JSON.stringify({ id, title }),
            )
            event.stopPropagation()
          }}
        >
          <h3>{title}</h3>
          <div className="mt-2">{content || <>&nbsp;</>}</div>
          <form
            onSubmit={(event) => {
              event.preventDefault()

              deleteCard.mutate({
                data: deleteItemSchema.parse({
                  id,
                  boardId,
                }),
              })
            }}
          >
            <button
              aria-label="Delete card"
              className="absolute top-4 right-4 hover:text-red-500 flex gap-2 items-center"
              type="submit"
            >
              <div className="opacity-50 text-xs">{order}</div>
              <Icon name="trash" />
            </button>
          </form>
        </div>
      </li>
    )
  },
)
