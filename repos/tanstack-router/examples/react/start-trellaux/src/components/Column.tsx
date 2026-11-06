import { forwardRef, useCallback, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { flushSync } from 'react-dom'
import { invariant } from '../invariant'
import { CONTENT_TYPES } from '../types'
import { Icon } from '../icons/icons'
import {
  useDeleteColumnMutation,
  useUpdateCardMutation,
  useUpdateColumnMutation,
} from '../queries'
import { EditableText } from './EditableText'
import { NewCard } from './NewCard'
import { Card } from './Card'
import type { RenderedItem } from '../types'

interface ColumnProps {
  name: string
  boardId: string
  columnId: string
  items: Array<RenderedItem>
  nextOrder: number
  previousOrder: number
  order: number
}

export const Column = forwardRef<HTMLDivElement, ColumnProps>(
  (
    { name, columnId, boardId, items, nextOrder, previousOrder, order },
    ref,
  ) => {
    const [acceptCardDrop, setAcceptCardDrop] = useState(false)
    const editState = useState(false)

    const [acceptColumnDrop, setAcceptColumnDrop] = useState<
      'none' | 'left' | 'right'
    >('none')

    const [edit, setEdit] = useState(false)

    const itemRef = useCallback((node: HTMLElement | null) => {
      node?.scrollIntoView({
        block: 'nearest',
      })
    }, [])

    const listRef = useRef<HTMLUListElement>(null!)

    function scrollList() {
      invariant(listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight
    }

    const updateColumnMutation = useUpdateColumnMutation()
    const deleteColumnMutation = useDeleteColumnMutation()
    const updateCardMutation = useUpdateCardMutation()

    const sortedItems = useMemo(
      () => [...items].sort((a, b) => a.order - b.order),
      [items],
    )

    const cardDndProps = {
      onDragOver: (event: React.DragEvent) => {
        if (event.dataTransfer.types.includes(CONTENT_TYPES.card)) {
          event.preventDefault()
          setAcceptCardDrop(true)
        }
      },
      onDragLeave: () => {
        setAcceptCardDrop(false)
      },
      onDrop: (event: React.DragEvent) => {
        const transfer = JSON.parse(
          event.dataTransfer.getData(CONTENT_TYPES.card) || 'null',
        )

        if (!transfer) {
          return
        }

        invariant(transfer.id, 'missing transfer.id')
        invariant(transfer.title, 'missing transfer.title')

        updateCardMutation.mutate({
          data: {
            order: (sortedItems[sortedItems.length - 1]?.order ?? 0) + 1,
            columnId: columnId,
            boardId,
            id: transfer.id,
            title: transfer.title,
          },
        })

        setAcceptCardDrop(false)
      },
    }

    return (
      <div
        ref={ref}
        onDragOver={(event: React.DragEvent) => {
          if (event.dataTransfer.types.includes(CONTENT_TYPES.column)) {
            event.preventDefault()
            event.stopPropagation()
            const rect = event.currentTarget.getBoundingClientRect()
            const midpoint = (rect.left + rect.right) / 2
            setAcceptColumnDrop(event.clientX <= midpoint ? 'left' : 'right')
          }
        }}
        onDragLeave={() => {
          setAcceptColumnDrop('none')
        }}
        onDrop={(event: React.DragEvent) => {
          const transfer = JSON.parse(
            event.dataTransfer.getData(CONTENT_TYPES.column) || 'null',
          )

          if (!transfer) {
            return
          }

          invariant(transfer.id, 'missing transfer.id')

          const droppedOrder =
            acceptColumnDrop === 'left' ? previousOrder : nextOrder
          const moveOrder = (droppedOrder + order) / 2

          updateColumnMutation.mutate({
            data: {
              boardId,
              id: transfer.id,
              order: moveOrder,
            },
          })

          setAcceptColumnDrop('none')
        }}
        className={twMerge(
          'border-l-transparent border-r-transparent border-l-2 border-r-2 -mr-[2px] last:mr-0 cursor-grab active:cursor-grabbing px-2 shrink-0 flex flex-col  max-h-full',
          acceptColumnDrop === 'left'
            ? 'border-l-red-500 border-r-transparent'
            : acceptColumnDrop === 'right'
              ? 'border-r-red-500 border-l-transparent'
              : '',
        )}
      >
        <div
          draggable={!editState[0]}
          onDragStart={(event: React.DragEvent) => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData(
              CONTENT_TYPES.column,
              JSON.stringify({ id: columnId, name }),
            )
          }}
          {...(!items.length ? cardDndProps : {})}
          className={twMerge(
            'shrink-0 flex flex-col max-h-full w-80 border-slate-400 rounded-xl shadow-xs shadow-slate-400 bg-slate-100 relative',
            acceptCardDrop && `outline-solid outline-2 outline-red-500`,
          )}
        >
          <div className="p-2" {...(items.length ? cardDndProps : {})}>
            <EditableText
              fieldName="name"
              editState={editState}
              value={
                // optimistic update
                updateColumnMutation.isPending &&
                updateColumnMutation.variables.data.name
                  ? updateColumnMutation.variables.data.name
                  : name
              }
              inputLabel="Edit column name"
              buttonLabel={`Edit column "${name}" name`}
              inputClassName="border border-slate-400 w-full rounded-lg py-1 px-2 font-medium text-black"
              buttonClassName="block rounded-lg text-left w-full border border-transparent py-1 px-2 font-medium text-slate-600"
              onChange={(value) => {
                updateColumnMutation.mutate({
                  data: {
                    boardId,
                    id: columnId,
                    name: value,
                  },
                })
              }}
            />
          </div>

          <ul ref={listRef} className="grow overflow-auto">
            {sortedItems.map((item, index, items) => (
              <Card
                ref={itemRef}
                key={item.id}
                title={item.title}
                content={item.content ?? ''}
                id={item.id}
                boardId={boardId}
                order={item.order}
                columnId={columnId}
                previousOrder={items[index - 1] ? items[index - 1].order : 0}
                nextOrder={
                  items[index + 1] ? items[index + 1].order : item.order + 1
                }
              />
            ))}
          </ul>
          {edit ? (
            <NewCard
              columnId={columnId}
              boardId={boardId}
              nextOrder={
                items.length === 0 ? 1 : items[items.length - 1].order + 1
              }
              onComplete={() => setEdit(false)}
            />
          ) : (
            <div className="p-2" {...(items.length ? cardDndProps : {})}>
              <button
                type="button"
                onClick={() => {
                  flushSync(() => {
                    setEdit(true)
                  })
                  scrollList()
                }}
                className="flex items-center gap-2 rounded-lg text-left w-full p-2 font-medium text-slate-500 hover:bg-slate-200 focus:bg-slate-200"
              >
                <Icon name="plus" /> Add a card
              </button>
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault()

              deleteColumnMutation.mutate({
                data: {
                  id: columnId,
                  boardId,
                },
              })
            }}
          >
            <button
              aria-label="Delete column"
              className="absolute top-4 right-4 hover:text-red-500 flex gap-2 items-center"
              type="submit"
            >
              <Icon name="trash" />
            </button>
          </form>
        </div>
      </div>
    )
  },
)
