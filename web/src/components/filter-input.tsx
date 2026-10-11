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
import { useEffect, useEffectEvent, useState, type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'

// Keep editing responsive while delaying network filters, including IME input.
export function FilterInput(
  props: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
    value: string
    onValueChange: (value: string) => void
  }
) {
  const { value, onValueChange, ...inputProps } = props
  const [draft, setDraft] = useState<{ base: string; value: string } | null>(
    null
  )
  const [composing, setComposing] = useState(false)
  if (draft && draft.base !== value) setDraft(null)
  const current = draft && draft.base === value ? draft.value : value
  const debounced = useDebounce(current, 400)
  const commit = useEffectEvent((next: string) => onValueChange(next))
  useEffect(() => {
    if (!composing && debounced === current && debounced !== value) {
      commit(debounced)
    }
  }, [composing, current, debounced, value])
  return (
    <Input
      {...inputProps}
      value={current}
      onChange={(event) => setDraft({ base: value, value: event.target.value })}
      onBlur={(event) => {
        if (!composing && current !== value) onValueChange(current)
        props.onBlur?.(event)
      }}
      onCompositionStart={(event) => {
        setComposing(true)
        props.onCompositionStart?.(event)
      }}
      onCompositionEnd={(event) => {
        setDraft({ base: value, value: event.currentTarget.value })
        setComposing(false)
        props.onCompositionEnd?.(event)
      }}
    />
  )
}
