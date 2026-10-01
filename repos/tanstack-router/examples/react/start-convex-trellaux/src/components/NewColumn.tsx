import { useRef, useState } from 'react'
import { invariant } from '../invariant'

import { Icon } from '../icons/icons'
import { useCreateColumnMutation } from '../queries'
import { CancelButton } from '~/components/CancelButton'
import { SaveButton } from '~/components/SaveButton'

export function NewColumn({
  boardId,
  editInitially,
  onNewColumnAdded,
}: {
  boardId: string
  editInitially: boolean
  onNewColumnAdded: () => void
}) {
  const [editing, setEditing] = useState(editInitially)
  const inputRef = useRef<HTMLInputElement>(null)

  const newColumnMutation = useCreateColumnMutation()

  return editing ? (
    <form
      className="ml-2 p-2 shrink-0 flex flex-col gap-5 overflow-hidden max-h-full w-80 border rounded-xl shadow-sm bg-slate-100"
      onSubmit={(event) => {
        event.preventDefault()
        invariant(inputRef.current, 'missing input ref')

        newColumnMutation.mutate({
          boardId,
          name: inputRef.current.value,
        })

        inputRef.current.value = ''

        onNewColumnAdded()
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setEditing(false)
        }
      }}
    >
      <input
        autoFocus
        required
        ref={inputRef}
        type="text"
        name="columnName"
        autoComplete="off"
        className="border border-slate-400 w-full rounded-lg py-1 px-2 font-medium text-black"
      />
      <div className="flex justify-between">
        <SaveButton>Save Column</SaveButton>
        <CancelButton onClick={() => setEditing(false)}>Cancel</CancelButton>
      </div>
    </form>
  ) : (
    <button
      onClick={() => {
        setEditing(true)
      }}
      aria-label="Add new column"
      className="ml-2 shrink-0 flex justify-center h-16 w-16 bg-black hover:bg-white bg-opacity-10 hover:bg-opacity-5 rounded-xl"
    >
      <Icon name="plus" size="xl" />
    </button>
  )
}
