import { forwardRef } from 'react'

export const CancelButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>((props, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      tabIndex={0}
      {...props}
      className="text-sm rounded-lg text-left p-2 font-medium hover:bg-slate-200 focus:bg-slate-200"
    />
  )
})
