import React from 'react'

type Props = {
  indeterminate?: boolean
} & React.HTMLProps<HTMLInputElement>

function IndeterminateCheckbox({
  indeterminate,
  className = '',
  ...rest
}: Props) {
  const ref = React.useRef<HTMLInputElement>(null!)

  React.useEffect(() => {
    if (typeof indeterminate === 'boolean') {
      ref.current.indeterminate = !rest.checked && indeterminate
    }
  }, [ref, indeterminate])

  return (
    <input
      type="checkbox"
      ref={ref}
      className={className + ' cursor-pointer'}
      {...rest}
    />
  )
}

export default IndeterminateCheckbox
