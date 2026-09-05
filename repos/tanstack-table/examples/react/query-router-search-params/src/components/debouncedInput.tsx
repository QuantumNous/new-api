import { InputHTMLAttributes, useEffect, useState } from 'react'

export function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 200,
  ...props
}: {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
  const [value, setValue] = useState<string | number>(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value)
    }, debounce)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      {...props}
      value={value ?? ''}
      onChange={e => {
        if (e.target.value === '') return setValue('')
        if (props.type === 'number') {
          setValue(e.target.valueAsNumber)
        } else {
          setValue(e.target.value)
        }
      }}
    />
  )
}
